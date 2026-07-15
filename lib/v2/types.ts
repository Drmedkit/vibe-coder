export type UserRole = 'student' | 'teacher' | 'admin'
export type RuntimeVersion = 'legacy-html' | 'preact-v1'
export type ProjectStatus = 'draft' | 'building' | 'ready' | 'failed' | 'paused'
export type BuildKind = 'first_build' | 'remix' | 'restore'
export type BuildStatus = 'queued' | 'planning' | 'generating' | 'compiling' | 'testing' | 'publishing' | 'complete' | 'failed'
export type CapabilityKind = 'data' | 'text_ai' | 'image_ai'

export interface SourceFile {
  path: string
  content: string
}

export interface CollectionField {
  name: string
  type: 'text' | 'number' | 'boolean'
  required?: boolean
  maxLength?: number
}

export interface CollectionCapability {
  name: string
  label: string
  operations: Array<'list' | 'create' | 'update' | 'increment'>
  fields: CollectionField[]
  maxRecords?: number
}

export interface ProjectCapabilities {
  collections: CollectionCapability[]
  textAI: boolean
  imageAI: boolean
}

export interface BuildAssetRequest {
  key: string
  prompt: string
  aspect: 'square' | 'landscape' | 'portrait'
}

export interface GeneratedProject {
  title: string
  summary: string
  files: SourceFile[]
  assets: BuildAssetRequest[]
  capabilities: ProjectCapabilities
}

export interface ProjectRecord {
  id: string
  ownerId: string
  classId: string | null
  title: string
  summary: string
  runtimeVersion: RuntimeVersion
  status: ProjectStatus
  approvedSlug: string | null
  approvedAt: string | null
  activeDeploymentId: string | null
  latestDeploymentId: string | null
  createdAt: string
  updatedAt: string
}

export interface DeploymentRecord {
  id: string
  projectId: string
  checkpointId: string
  publicToken: string
  artifactPath: string
  isSafe: boolean
  createdAt: string
}

export interface BuildJobRecord {
  id: string
  projectId: string
  ownerId: string
  kind: BuildKind
  prompt: string
  status: BuildStatus
  progress: number
  error: string | null
  deploymentId: string | null
  createdAt: string
  updatedAt: string
}

export interface BuildEventRecord {
  id: number
  buildId: string
  type: 'status' | 'message' | 'asset' | 'error' | 'complete'
  message: string
  progress: number
  createdAt: string
}
