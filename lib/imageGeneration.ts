import { GoogleGenAI } from '@google/genai'

const stylePrompts: Record<string, string> = {
  character: 'game character sprite, front view, pixel art style, isolated on transparent background',
  background: 'game background, seamless, vibrant colors, wide landscape',
  item: 'game item icon, centered, transparent background, collectible style',
  icon: 'simple icon, flat design, centered, minimalist, transparent background',
}

export async function generateGameAsset(
  description: string,
  assetType: 'character' | 'background' | 'item' | 'icon'
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const fullPrompt = `${description}, ${stylePrompts[assetType] ?? stylePrompts.item}`

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-fast-generate-001',
    prompt: fullPrompt,
    config: { numberOfImages: 1, outputMimeType: 'image/png' },
  })

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new Error('Geen afbeelding ontvangen van Imagen')

  return `data:image/png;base64,${imageBytes}`
}
