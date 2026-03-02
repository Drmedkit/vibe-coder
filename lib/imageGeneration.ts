import { GoogleGenAI } from '@google/genai'

export interface GeneratedImage {
  id: string
  prompt: string
  url: string
  timestamp: number
}

const stylePrompts = {
  character: 'game character sprite, front view, transparent background, pixel art style',
  background: 'game background, seamless, vibrant colors, landscape',
  item: 'game item icon, centered, clean background, collectible',
  icon: 'simple icon, flat design, centered, minimalist'
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: prompt,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)

  if (!imagePart?.inlineData) {
    throw new Error('Geen afbeelding ontvangen van Gemini')
  }

  const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string }
  const url = `data:${mimeType};base64,${data}`

  return {
    id: `gemini-${Date.now()}`,
    prompt,
    url,
    timestamp: Date.now()
  }
}

export async function generateGameAsset(
  description: string,
  assetType: 'character' | 'background' | 'item' | 'icon'
): Promise<GeneratedImage> {
  const fullPrompt = `${description}, ${stylePrompts[assetType]}`
  return generateImage(fullPrompt)
}
