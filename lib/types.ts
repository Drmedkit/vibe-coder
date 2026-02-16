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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ProjectData {
  id?: string
  title: string
  description?: string
  code: CodeState
  isPublished: boolean
}

export interface Asset {
  id: string
  name: string
  type: 'IMAGE' | 'ICON' | 'BACKGROUND'
  url: string
  prompt?: string
}
