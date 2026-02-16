import * as fal from '@fal-ai/client'

// FAL client uses FAL_KEY environment variable automatically

export interface GeneratedImage {
  id: string
  prompt: string
  url: string
  timestamp: number
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  try {
    // FAL_KEY is the environment variable FAL.ai expects
    if (!process.env.FAL_KEY) {
      // Return a placeholder for demo purposes
      return {
        id: `demo-${Date.now()}`,
        prompt,
        url: `https://placehold.co/512x512/667eea/white?text=${encodeURIComponent(prompt.slice(0, 20))}`,
        timestamp: Date.now()
      }
    }

    // Enhance the prompt for better game assets
    const enhancedPrompt = `${prompt}, game asset, clean background, vibrant colors, high quality, digital art style`

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: enhancedPrompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('Image generation in progress...')
        }
      }
    })

    const imageUrl = result.data.images[0]?.url

    if (!imageUrl) {
      throw new Error('No image generated')
    }

    return {
      id: `gen-${Date.now()}`,
      prompt,
      url: imageUrl,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('FAL Image Generation Error:', error)
    throw new Error('Failed to generate image. Please try again.')
  }
}

// Alternative: Generate asset with specific style
export async function generateGameAsset(
  description: string,
  assetType: 'character' | 'background' | 'item' | 'icon'
): Promise<GeneratedImage> {
  const stylePrompts = {
    character: 'game character sprite, front view, transparent background, pixel art style',
    background: 'game background, seamless, vibrant colors, landscape',
    item: 'game item icon, centered, clean background, collectible',
    icon: 'simple icon, flat design, centered, minimalist'
  }

  const fullPrompt = `${description}, ${stylePrompts[assetType]}`
  return generateImage(fullPrompt)
}
