import { getArtifactStore, getDatabase } from '@/lib/cloudflare'
import { makeId, nowIso } from '@/lib/sqlite'
import { compileProject } from '@/lib/v2/compiler'
import { generateProject, repairProject } from '@/lib/v2/build-ai'
import { generateCreativeAsset } from '@/lib/imageGeneration'
import { storeDataUrlAsset } from '@/lib/v2/assets'
import { moderateText } from '@/lib/v2/moderation'
import {
  addBuildEvent,
  claimNextBuildJob,
  createCheckpoint,
  createDeployment,
  getCheckpoint,
  getProject,
  getProjectFiles,
  replaceCapabilities,
  replaceProjectFiles,
  updateBuildJob,
  updateProject,
} from '@/lib/v2/repository'
import { assertCredits, CREDIT_POLICY, spendCredits } from '@/lib/v2/quotas'
import { BuildJobRecord, BuildStatus, GeneratedProject, SourceFile } from '@/lib/v2/types'

const workerState = globalThis as unknown as { vibeBuildPromise?: Promise<void> }

async function event(buildId: string, status: BuildStatus, progress: number, message: string) {
  await updateBuildJob(buildId, status, progress)
  await addBuildEvent(buildId, 'message', message, progress)
}

function replaceAssetPlaceholders(files: SourceFile[], assets: Map<string, string>): SourceFile[] {
  const fallback = assets.values().next().value || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  return files.map(file => ({
    ...file,
    content: file.content.replace(/asset:\/\/([a-z0-9_-]+)/gi, (_match, key: string) => assets.get(key) || fallback),
  }))
}

async function createAssets(job: BuildJobRecord, generated: GeneratedProject) {
  const urls = new Map<string, string>()
  for (let index = 0; index < generated.assets.length; index += 1) {
    const request = generated.assets[index]
    const progress = 30 + Math.round(((index + 1) / generated.assets.length) * 14)
    await addBuildEvent(job.id, 'asset', `Creating artwork ${index + 1} of ${generated.assets.length}`, progress)
    // Count the attempt before calling the paid provider so failed/abandoned
    // builds cannot be used to bypass the daily image budget.
    await spendCredits(job.ownerId, job.projectId, 'builder_image', CREDIT_POLICY.image)
    const dataUrl = await generateCreativeAsset(request.prompt, request.aspect)
    const stored = await storeDataUrlAsset({
      ownerId: job.ownerId,
      projectId: job.projectId,
      prompt: request.prompt,
      dataUrl,
    })
    urls.set(request.key, stored.url)
  }
  return urls
}

async function storeArtifacts(prefix: string, artifacts: Awaited<ReturnType<typeof compileProject>>) {
  const store = await getArtifactStore()
  await Promise.all(artifacts.map(artifact => store.put(`${prefix}/${artifact.name}`, artifact.body)))
}

async function runJob(job: BuildJobRecord) {
  const project = await getProject(job.projectId)
  if (!project) throw new Error('Project no longer exists.')
  const existingFiles = await getProjectFiles(project.id)
  const buildCost = job.kind === 'restore'
    ? 0
    : job.kind === 'first_build'
      ? CREDIT_POLICY.firstBuild
      : CREDIT_POLICY.remix
  await assertCredits(job.ownerId, buildCost)

  await event(job.id, 'planning', 8, job.kind === 'first_build'
    ? 'Finding the strongest version of your idea'
    : job.kind === 'restore'
      ? 'Restoring the selected checkpoint'
      : 'Mapping the remix onto what already works')

  let generated: GeneratedProject
  if (job.kind === 'restore') {
    const checkpoint = await getCheckpoint(job.prompt)
    if (!checkpoint || checkpoint.projectId !== project.id) throw new Error('Checkpoint not found.')
    generated = {
      title: project.title,
      summary: project.summary,
      files: checkpoint.files,
      assets: [],
      capabilities: checkpoint.capabilities,
    }
  } else {
    generated = await generateProject({
      prompt: job.prompt,
      existingFiles: existingFiles.length > 0 ? existingFiles : undefined,
      currentTitle: project.title,
      currentSummary: project.summary,
    })
  }

  const totalCost = buildCost + generated.assets.length * CREDIT_POLICY.image
  await assertCredits(job.ownerId, totalCost)
  await event(job.id, 'generating', 24, 'Building the interaction and visual system')

  const assetUrls = generated.assets.length > 0 ? await createAssets(job, generated) : new Map<string, string>()
  generated = { ...generated, files: replaceAssetPlaceholders(generated.files, assetUrls) }

  const publicToken = makeId('p').slice(2)
  const artifactPrefix = `deployments/${job.id}`
  let compileError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await event(
        job.id,
        'compiling',
        52 + attempt * 8,
        attempt === 0 ? 'Compiling the creation' : `Repairing build issue ${attempt}`,
      )
      const artifacts = await compileProject({
        files: generated.files,
        title: generated.title,
        deploymentToken: publicToken,
      })
      await storeArtifacts(artifactPrefix, artifacts)
      compileError = null
      break
    } catch (error) {
      compileError = error
      console.warn(`Build ${job.id} compile attempt ${attempt + 1} failed:`, error)
      if (attempt >= 2) break
      generated = await repairProject({
        project: generated,
        error: error instanceof Error ? error.message : String(error),
      })
      generated = { ...generated, files: replaceAssetPlaceholders(generated.files, assetUrls) }
    }
  }
  if (compileError) throw compileError

  await event(job.id, 'testing', 78, 'Checking the first screen and interactions')
  const moderation = moderateText(`${job.prompt}\n${generated.title}\n${generated.summary}\n${generated.files.map(file => file.content).join('\n')}`)

  await replaceProjectFiles(project.id, generated.files)
  await replaceCapabilities(project.id, generated.capabilities)
  await updateProject(project.id, {
    title: generated.title,
    summary: generated.summary,
    status: moderation.allowed ? 'ready' : 'paused',
  })
  const checkpointId = await createCheckpoint({
    projectId: project.id,
    buildId: job.id,
    label: job.kind === 'first_build' ? 'First live version' : job.prompt.slice(0, 58),
    prompt: job.prompt,
    files: generated.files,
    capabilities: generated.capabilities,
  })

  await event(job.id, 'publishing', 90, 'Publishing the unlisted link')
  const deployment = await createDeployment({
    projectId: project.id,
    checkpointId,
    artifactPath: artifactPrefix,
    isSafe: moderation.allowed,
    publicToken,
  })
  await (await getDatabase()).prepare(`
    INSERT INTO moderation_events (id, project_id, deployment_id, source, status, reason, created_at)
    VALUES (?, ?, ?, 'build', ?, ?, ?)
  `).bind(
    makeId('moderation'),
    project.id,
    deployment.id,
    moderation.allowed ? 'allowed' : 'flagged',
    moderation.reason || null,
    nowIso(),
  ).run()
  if (buildCost > 0) await spendCredits(job.ownerId, project.id, job.kind, buildCost)

  await updateBuildJob(job.id, 'complete', 100, { deploymentId: deployment.id, error: null })
  await addBuildEvent(
    job.id,
    'complete',
    moderation.allowed ? 'Your creation is live' : 'Built, but an adult needs to review it before sharing',
    100,
  )
}

async function drainBuildQueue() {
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString()
  await (await getDatabase()).prepare(`
    UPDATE build_jobs SET status = 'queued', progress = 0, error = NULL, updated_at = ?
    WHERE status NOT IN ('queued', 'complete', 'failed') AND updated_at < ?
  `).bind(nowIso(), staleBefore).run()
  for (;;) {
    const job = await claimNextBuildJob()
    if (!job) return
    try {
      await runJob(job)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The build stopped unexpectedly.'
      await updateBuildJob(job.id, 'failed', 100, { error: message })
      await updateProject(job.projectId, { status: 'failed' })
      await addBuildEvent(job.id, 'error', message, 100)
    }
  }
}

export async function kickBuildWorker(): Promise<void> {
  if (!workerState.vibeBuildPromise) {
    workerState.vibeBuildPromise = drainBuildQueue().finally(() => {
      workerState.vibeBuildPromise = undefined
    })
  }
  return workerState.vibeBuildPromise
}
