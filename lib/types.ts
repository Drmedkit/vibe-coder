export type ChatMode = 'plan' | 'build' | 'explain'

export type ProjectPhase = 'empty' | 'shaping' | 'ready_for_first_build' | 'built' | 'polishing'

export type AIIntent = 'director' | 'first_build' | 'inspect' | 'adjust' | 'major_rebuild'

export type ChatAction = 'first_build' | 'inspect' | 'adjust' | 'major_rebuild'

export type CodeUpdateIntent = 'first_build' | 'adjust' | 'major_rebuild'

export interface ProjectBrief {
  rawIdea: string
  goal?: string
  coreExperience?: string
  mustHaves: string[]
  styleNotes: string[]
  constraints: string[]
  confirmedChoices: string[]
  unresolvedQuestions: string[]
  qualityBar?: string
}

export interface BriefReadiness {
  score: number
  readyForFirstBuild: boolean
  missing: string[]
  reason: string
}

export interface ChatWorkspaceContext {
  phase: ProjectPhase
  brief: ProjectBrief
  majorBuildCount: number
}

export enum Language {
  HTML = 'html',
  CSS = 'css',
  JAVASCRIPT = 'javascript',
  CHAT = 'chat'
}

export interface CodeState {
  html: string
  css: string
  javascript: string
}

export interface EditPatch {
  file: 'html' | 'css' | 'js'
  find: string
  replace: string
}

export type ToolResult =
  | { type: 'code_update'; intent?: CodeUpdateIntent; html?: string; css?: string; javascript?: string }
  | { type: 'edit_patches'; patches: EditPatch[] }
  | { type: 'image_generated'; url: string; prompt: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolResult?: ToolResult
}

export interface ProjectData {
  id?: string
  title: string
  description?: string
  code: CodeState
  isPublished: boolean
  phase?: ProjectPhase
  brief?: ProjectBrief
  firstBuildAcceptedAt?: number
  majorBuildCount?: number
}

export interface Asset {
  id: string
  prompt: string
  assetType: 'character' | 'background' | 'item' | 'icon'
  url: string
  timestamp: number
}
