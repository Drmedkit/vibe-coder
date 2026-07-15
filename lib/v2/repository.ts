import { getDatabase } from '@/lib/cloudflare'
import { makeId, nowIso, parseJson, toBoolean } from '@/lib/sqlite'
import {
  BuildEventRecord,
  BuildJobRecord,
  BuildKind,
  BuildStatus,
  DeploymentRecord,
  ProjectCapabilities,
  ProjectRecord,
  SourceFile,
} from '@/lib/v2/types'

interface ProjectRow {
  id: string
  owner_id: string
  class_id: string | null
  title: string
  summary: string
  runtime_version: ProjectRecord['runtimeVersion']
  status: ProjectRecord['status']
  approved_slug: string | null
  approved_at: string | null
  active_deployment_id: string | null
  latest_deployment_id: string | null
  created_at: string
  updated_at: string
}

interface BuildRow {
  id: string
  project_id: string
  owner_id: string
  kind: BuildJobRecord['kind']
  prompt: string
  status: BuildJobRecord['status']
  progress: number
  error: string | null
  deployment_id: string | null
  created_at: string
  updated_at: string
}

interface DeploymentRow {
  id: string
  project_id: string
  checkpoint_id: string
  public_token: string
  artifact_path: string
  is_safe: number
  created_at: string
}

const EMPTY_CAPABILITIES: ProjectCapabilities = {
  collections: [],
  textAI: false,
  imageAI: false,
}

function projectFromRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    classId: row.class_id,
    title: row.title,
    summary: row.summary,
    runtimeVersion: row.runtime_version,
    status: row.status,
    approvedSlug: row.approved_slug,
    approvedAt: row.approved_at,
    activeDeploymentId: row.active_deployment_id,
    latestDeploymentId: row.latest_deployment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildFromRow(row: BuildRow): BuildJobRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    kind: row.kind,
    prompt: row.prompt,
    status: row.status,
    progress: row.progress,
    error: row.error,
    deploymentId: row.deployment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function deploymentFromRow(row: DeploymentRow): DeploymentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    checkpointId: row.checkpoint_id,
    publicToken: row.public_token,
    artifactPath: row.artifact_path,
    isSafe: toBoolean(row.is_safe),
    createdAt: row.created_at,
  }
}

export async function createProject(input: {
  ownerId: string
  classId: string | null
  title?: string
  summary?: string
  runtimeVersion?: ProjectRecord['runtimeVersion']
}): Promise<ProjectRecord> {
  const timestamp = nowIso()
  const project: ProjectRow = {
    id: makeId('project'),
    owner_id: input.ownerId,
    class_id: input.classId,
    title: input.title?.trim() || 'Untitled creation',
    summary: input.summary?.trim() || '',
    runtime_version: input.runtimeVersion || 'preact-v1',
    status: 'draft',
    approved_slug: null,
    approved_at: null,
    active_deployment_id: null,
    latest_deployment_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const db = await getDatabase()
  await db.prepare(`
    INSERT INTO projects (
      id, owner_id, class_id, title, summary, runtime_version, status,
      approved_slug, approved_at, active_deployment_id, latest_deployment_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
  `).bind(
    project.id, project.owner_id, project.class_id, project.title, project.summary,
    project.runtime_version, project.status, project.created_at, project.updated_at,
  ).run()
  return projectFromRow(project)
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const row = await (await getDatabase()).prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first<ProjectRow>()
  return row ? projectFromRow(row) : null
}

export async function getOwnedProject(projectId: string, ownerId: string): Promise<ProjectRecord | null> {
  const row = await (await getDatabase()).prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?')
    .bind(projectId, ownerId).first<ProjectRow>()
  return row ? projectFromRow(row) : null
}

export async function canManageProject(
  projectId: string,
  user: { id: string; role: string; classId: string | null },
): Promise<boolean> {
  if (user.role === 'admin') return true
  const db = await getDatabase()
  if (user.role === 'student') {
    return Boolean(await db.prepare('SELECT 1 AS ok FROM projects WHERE id = ? AND owner_id = ?')
      .bind(projectId, user.id).first())
  }
  return Boolean(await db.prepare(`
    SELECT 1 AS ok FROM projects
    WHERE id = ? AND (class_id IN (SELECT id FROM classes WHERE owner_id = ?) OR owner_id = ?)
  `).bind(projectId, user.id, user.id).first())
}

export async function listProjectsForUser(
  user: { id: string; role: string; classId: string | null },
): Promise<ProjectRecord[]> {
  const db = await getDatabase()
  let statement: D1PreparedStatement
  if (user.role === 'admin') {
    statement = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC')
  } else if (user.role === 'teacher') {
    statement = db.prepare(`
      SELECT * FROM projects
      WHERE owner_id = ? OR class_id IN (SELECT id FROM classes WHERE owner_id = ?)
      ORDER BY updated_at DESC
    `).bind(user.id, user.id)
  } else {
    statement = db.prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC').bind(user.id)
  }
  const { results } = await statement.all<ProjectRow>()
  return results.map(projectFromRow)
}

export async function updateProject(projectId: string, patch: {
  title?: string
  summary?: string
  status?: ProjectRecord['status']
}): Promise<ProjectRecord> {
  const current = await getProject(projectId)
  if (!current) throw new Error('Project not found')
  await (await getDatabase()).prepare(`
    UPDATE projects SET title = ?, summary = ?, status = ?, updated_at = ? WHERE id = ?
  `).bind(
    patch.title?.trim() || current.title,
    patch.summary?.trim() ?? current.summary,
    patch.status || current.status,
    nowIso(),
    projectId,
  ).run()
  return (await getProject(projectId)) as ProjectRecord
}

export async function deleteProject(projectId: string): Promise<void> {
  await (await getDatabase()).prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run()
}

export async function getProjectFiles(projectId: string): Promise<SourceFile[]> {
  const { results } = await (await getDatabase())
    .prepare('SELECT path, content FROM project_files WHERE project_id = ? ORDER BY path')
    .bind(projectId).all<SourceFile>()
  return results
}

export async function replaceProjectFiles(projectId: string, files: SourceFile[]): Promise<void> {
  const db = await getDatabase()
  const timestamp = nowIso()
  const statements = [db.prepare('DELETE FROM project_files WHERE project_id = ?').bind(projectId)]
  for (const file of files) {
    statements.push(db.prepare(`
      INSERT INTO project_files (project_id, path, content, updated_at) VALUES (?, ?, ?, ?)
    `).bind(projectId, file.path, file.content, timestamp))
  }
  statements.push(db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(timestamp, projectId))
  await db.batch(statements)
}

export async function getCapabilities(projectId: string): Promise<ProjectCapabilities> {
  const { results } = await (await getDatabase()).prepare(`
    SELECT kind, config, enabled FROM project_capabilities WHERE project_id = ?
  `).bind(projectId).all<{ kind: string; config: string; enabled: number }>()
  const capabilities = structuredClone(EMPTY_CAPABILITIES)
  for (const row of results) {
    if (!toBoolean(row.enabled)) continue
    if (row.kind === 'data') capabilities.collections = parseJson(row.config, [])
    if (row.kind === 'text_ai') capabilities.textAI = true
    if (row.kind === 'image_ai') capabilities.imageAI = true
  }
  return capabilities
}

export async function replaceCapabilities(projectId: string, capabilities: ProjectCapabilities): Promise<void> {
  const db = await getDatabase()
  const timestamp = nowIso()
  const statements = [db.prepare('DELETE FROM project_capabilities WHERE project_id = ?').bind(projectId)]
  const insert = (kind: string, config: string) => db.prepare(`
    INSERT INTO project_capabilities (project_id, kind, config, enabled, updated_at)
    VALUES (?, ?, ?, 1, ?)
  `).bind(projectId, kind, config, timestamp)
  if (capabilities.collections.length > 0) statements.push(insert('data', JSON.stringify(capabilities.collections)))
  if (capabilities.textAI) statements.push(insert('text_ai', '{}'))
  if (capabilities.imageAI) statements.push(insert('image_ai', '{}'))
  await db.batch(statements)
}

export async function createBuildJob(input: {
  projectId: string
  ownerId: string
  kind: BuildKind
  prompt: string
}): Promise<BuildJobRecord> {
  const timestamp = nowIso()
  const row: BuildRow = {
    id: makeId('build'),
    project_id: input.projectId,
    owner_id: input.ownerId,
    kind: input.kind,
    prompt: input.prompt,
    status: 'queued',
    progress: 0,
    error: null,
    deployment_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const db = await getDatabase()
  await db.batch([
    db.prepare(`
      INSERT INTO build_jobs (
        id, project_id, owner_id, kind, prompt, status, progress, error,
        deployment_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `).bind(row.id, row.project_id, row.owner_id, row.kind, row.prompt, row.status, row.progress, row.created_at, row.updated_at),
    db.prepare(`
      INSERT INTO build_events (build_id, type, message, progress, created_at)
      VALUES (?, 'status', 'Queued for build', 0, ?)
    `).bind(row.id, timestamp),
    db.prepare("UPDATE projects SET status = 'building', updated_at = ? WHERE id = ?").bind(timestamp, input.projectId),
  ])
  return buildFromRow(row)
}

export async function getBuildJob(buildId: string): Promise<BuildJobRecord | null> {
  const row = await (await getDatabase()).prepare('SELECT * FROM build_jobs WHERE id = ?').bind(buildId).first<BuildRow>()
  return row ? buildFromRow(row) : null
}

export async function claimNextBuildJob(): Promise<BuildJobRecord | null> {
  const db = await getDatabase()
  const row = await db.prepare(`
    SELECT * FROM build_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1
  `).first<BuildRow>()
  if (!row) return null
  const result = await db.prepare(`
    UPDATE build_jobs SET status = 'planning', progress = 5, updated_at = ?
    WHERE id = ? AND status = 'queued'
  `).bind(nowIso(), row.id).run()
  if (result.meta.changes !== 1) return null
  return getBuildJob(row.id)
}

export async function updateBuildJob(buildId: string, status: BuildStatus, progress: number, patch?: {
  error?: string | null
  deploymentId?: string | null
}): Promise<BuildJobRecord> {
  const current = await getBuildJob(buildId)
  if (!current) throw new Error('Build not found')
  await (await getDatabase()).prepare(`
    UPDATE build_jobs SET status = ?, progress = ?, error = ?, deployment_id = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    status,
    Math.max(0, Math.min(100, Math.round(progress))),
    patch?.error === undefined ? current.error : patch.error,
    patch?.deploymentId === undefined ? current.deploymentId : patch.deploymentId,
    nowIso(),
    buildId,
  ).run()
  return (await getBuildJob(buildId)) as BuildJobRecord
}

export async function addBuildEvent(
  buildId: string,
  type: BuildEventRecord['type'],
  message: string,
  progress: number,
): Promise<BuildEventRecord> {
  const createdAt = nowIso()
  const result = await (await getDatabase()).prepare(`
    INSERT INTO build_events (build_id, type, message, progress, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(buildId, type, message, progress, createdAt).run()
  return {
    id: Number(result.meta.last_row_id),
    buildId,
    type,
    message,
    progress,
    createdAt,
  }
}

export async function listBuildEvents(buildId: string, afterId = 0): Promise<BuildEventRecord[]> {
  const { results } = await (await getDatabase()).prepare(`
    SELECT id, build_id, type, message, progress, created_at
    FROM build_events WHERE build_id = ? AND id > ? ORDER BY id
  `).bind(buildId, afterId).all<{
    id: number
    build_id: string
    type: BuildEventRecord['type']
    message: string
    progress: number
    created_at: string
  }>()
  return results.map(row => ({
    id: row.id,
    buildId: row.build_id,
    type: row.type,
    message: row.message,
    progress: row.progress,
    createdAt: row.created_at,
  }))
}

export async function createCheckpoint(input: {
  projectId: string
  buildId?: string
  label: string
  prompt: string
  files: SourceFile[]
  capabilities: ProjectCapabilities
}): Promise<string> {
  const id = makeId('checkpoint')
  await (await getDatabase()).prepare(`
    INSERT INTO checkpoints (
      id, project_id, build_id, label, prompt, files_json, capabilities_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, input.projectId, input.buildId || null, input.label, input.prompt,
    JSON.stringify(input.files), JSON.stringify(input.capabilities), nowIso(),
  ).run()
  return id
}

export async function listCheckpoints(projectId: string): Promise<Array<{
  id: string
  label: string
  prompt: string
  createdAt: string
}>> {
  const { results } = await (await getDatabase()).prepare(`
    SELECT id, label, prompt, created_at AS createdAt
    FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 30
  `).bind(projectId).all<{ id: string; label: string; prompt: string; createdAt: string }>()
  return results
}

export async function getCheckpoint(checkpointId: string): Promise<{
  id: string
  projectId: string
  label: string
  files: SourceFile[]
  capabilities: ProjectCapabilities
} | null> {
  const row = await (await getDatabase()).prepare(`
    SELECT id, project_id, label, files_json, capabilities_json FROM checkpoints WHERE id = ?
  `).bind(checkpointId).first<{
    id: string
    project_id: string
    label: string
    files_json: string
    capabilities_json: string
  }>()
  if (!row) return null
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    files: parseJson(row.files_json, []),
    capabilities: parseJson(row.capabilities_json, EMPTY_CAPABILITIES),
  }
}

export async function createDeployment(input: {
  projectId: string
  checkpointId: string
  artifactPath: string
  isSafe: boolean
  publicToken?: string
}): Promise<DeploymentRecord> {
  const row: DeploymentRow = {
    id: makeId('deployment'),
    project_id: input.projectId,
    checkpoint_id: input.checkpointId,
    public_token: input.publicToken || makeId('p').slice(2),
    artifact_path: input.artifactPath,
    is_safe: input.isSafe ? 1 : 0,
    created_at: nowIso(),
  }
  const project = await getProject(input.projectId)
  const shouldPromote = input.isSafe && Boolean(project?.approvedSlug)
  const db = await getDatabase()
  await db.batch([
    db.prepare(`
      INSERT INTO deployments (
        id, project_id, checkpoint_id, public_token, artifact_path, is_safe, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.project_id, row.checkpoint_id, row.public_token,
      row.artifact_path, row.is_safe, row.created_at,
    ),
    db.prepare(`
      UPDATE projects SET latest_deployment_id = ?, active_deployment_id = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.id,
      shouldPromote ? row.id : project?.activeDeploymentId || null,
      input.isSafe ? 'ready' : 'paused',
      nowIso(),
      input.projectId,
    ),
  ])
  return deploymentFromRow(row)
}

export async function getDeploymentByToken(publicToken: string): Promise<DeploymentRecord | null> {
  const row = await (await getDatabase()).prepare('SELECT * FROM deployments WHERE public_token = ?')
    .bind(publicToken).first<DeploymentRow>()
  return row ? deploymentFromRow(row) : null
}

export async function getDeploymentById(deploymentId: string): Promise<DeploymentRecord | null> {
  const row = await (await getDatabase()).prepare('SELECT * FROM deployments WHERE id = ?')
    .bind(deploymentId).first<DeploymentRow>()
  return row ? deploymentFromRow(row) : null
}

export async function getActiveDeploymentBySlug(slug: string): Promise<DeploymentRecord | null> {
  const row = await (await getDatabase()).prepare(`
    SELECT deployments.* FROM projects
    JOIN deployments ON deployments.id = projects.active_deployment_id
    WHERE projects.approved_slug = ? AND projects.status != 'paused'
  `).bind(slug).first<DeploymentRow>()
  return row ? deploymentFromRow(row) : null
}

export async function approveProject(projectId: string, slug: string): Promise<ProjectRecord> {
  const project = await getProject(projectId)
  if (!project) throw new Error('Project not found')
  const cleanSlug = slug.trim().toLowerCase()
  const latest = project.latestDeploymentId ? await getDeploymentById(project.latestDeploymentId) : null
  await (await getDatabase()).prepare(`
    UPDATE projects SET approved_slug = ?, approved_at = ?, active_deployment_id = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    cleanSlug,
    nowIso(),
    latest?.isSafe ? latest.id : project.activeDeploymentId,
    latest?.isSafe ? 'ready' : project.status,
    nowIso(),
    projectId,
  ).run()
  return (await getProject(projectId)) as ProjectRecord
}

export async function unpublishProject(projectId: string): Promise<ProjectRecord> {
  await (await getDatabase()).prepare(`
    UPDATE projects SET approved_slug = NULL, approved_at = NULL, active_deployment_id = NULL,
      status = CASE WHEN latest_deployment_id IS NULL THEN 'draft' ELSE 'ready' END, updated_at = ?
    WHERE id = ?
  `).bind(nowIso(), projectId).run()
  return (await getProject(projectId)) as ProjectRecord
}

export async function getProjectByDeployment(deploymentId: string): Promise<ProjectRecord | null> {
  const row = await (await getDatabase()).prepare(`
    SELECT projects.* FROM deployments JOIN projects ON projects.id = deployments.project_id
    WHERE deployments.id = ?
  `).bind(deploymentId).first<ProjectRow>()
  return row ? projectFromRow(row) : null
}
