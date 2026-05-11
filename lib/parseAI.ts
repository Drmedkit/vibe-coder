import { EditPatch } from './types'

export function extractTag(raw: string, tag: string): string | undefined {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() || undefined
}

export function extractEditPatches(raw: string): EditPatch[] {
  const patches: EditPatch[] = []
  const editRegex = /<edit\s+file="(html|css|js)">\s*<find>([\s\S]*?)<\/find>\s*<replace>([\s\S]*?)<\/replace>\s*<\/edit>/gi
  let match
  while ((match = editRegex.exec(raw)) !== null) {
    patches.push({
      file: match[1] as 'html' | 'css' | 'js',
      find: match[2],
      replace: match[3],
    })
  }
  return patches
}

export function extractImageTag(raw: string): { prompt: string; assetType: string } | undefined {
  const match = raw.match(/<image\s+prompt="([^"]+)"\s+type="([^"]+)"\s*\/>/i)
    ?? raw.match(/<image\s+type="([^"]+)"\s+prompt="([^"]+)"\s*\/>/i)
  if (!match) return undefined
  const isPromptFirst = raw.match(/<image\s+prompt=/) !== null
  return isPromptFirst
    ? { prompt: match[1], assetType: match[2] }
    : { prompt: match[2], assetType: match[1] }
}
