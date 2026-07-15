import { GoogleGenAI } from '@google/genai'

const stylePrompts: Record<string, string> = {
  character: 'distinctive illustrated character, clear silhouette, isolated on a transparent background',
  background: 'editorial digital artwork, layered depth, wide composition, no text or logos',
  item: 'polished digital object, centered composition, isolated on a transparent background',
  icon: 'precise graphic symbol, flat vector style, centered, transparent background',
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

export async function generateCreativeAsset(
  description: string,
  aspect: 'square' | 'landscape' | 'portrait' = 'landscape',
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const composition = aspect === 'square'
    ? 'square composition'
    : aspect === 'portrait'
      ? 'portrait composition'
      : 'wide landscape composition'
  const response = await ai.models.generateImages({
    model: process.env.IMAGE_MODEL || 'imagen-4.0-fast-generate-001',
    prompt: `${description}, ${composition}, sophisticated digital art, no text, no watermark`,
    config: { numberOfImages: 1, outputMimeType: 'image/png' },
  })

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new Error('No image was returned by the image model')
  return `data:image/png;base64,${imageBytes}`
}
