import OpenAI from 'openai'
import { generateCreativeAsset } from '@/lib/imageGeneration'
import { storeDataUrlAsset } from '@/lib/v2/assets'
import { moderateText } from '@/lib/v2/moderation'
import { assertCredits, assertRuntimeCall, CREDIT_POLICY, spendCredits } from '@/lib/v2/quotas'
import { getCapabilities } from '@/lib/v2/repository'
import { ProjectRecord } from '@/lib/v2/types'

function client(): OpenAI {
  const useXAI = Boolean(process.env.XAI_API_KEY)
  const apiKey = useXAI ? process.env.XAI_API_KEY : process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Runtime AI is not configured.')
  return new OpenAI({
    baseURL: useXAI ? 'https://api.x.ai/v1' : 'https://openrouter.ai/api/v1',
    apiKey,
  })
}

export async function runtimeText(project: ProjectRecord, prompt: string) {
  if (!(await getCapabilities(project.id)).textAI) throw new Error('Text AI is not enabled for this creation.')
  const cleanPrompt = prompt.trim().slice(0, 2_000)
  if (!cleanPrompt) throw new Error('A prompt is required.')
  const moderation = moderateText(cleanPrompt)
  if (!moderation.allowed) throw new Error(moderation.reason)
  await assertRuntimeCall(project.id, 'runtime_text')
  await assertCredits(project.ownerId, 1)
  await spendCredits(project.ownerId, project.id, 'runtime_text', 1)
  const useXAI = Boolean(process.env.XAI_API_KEY)
  const response = await client().chat.completions.create({
    model: process.env.RUNTIME_TEXT_MODEL || process.env.FAST_MODEL || (useXAI ? 'grok-4.3-mini' : 'google/gemini-2.5-flash-lite'),
    messages: [
      {
        role: 'system',
        content: `You are a feature inside a student-created project titled "${project.title}". Give a concise, safe, useful answer for a general audience. Do not request personal information.`,
      },
      { role: 'user', content: cleanPrompt },
    ],
    max_tokens: 500,
    temperature: 0.7,
  })
  const text = response.choices[0]?.message?.content?.trim() || ''
  const outputModeration = moderateText(text)
  if (!outputModeration.allowed) throw new Error('The generated answer needs an adult review.')
  return { text }
}

export async function runtimeImage(project: ProjectRecord, prompt: string) {
  if (!(await getCapabilities(project.id)).imageAI) throw new Error('Image AI is not enabled for this creation.')
  const cleanPrompt = prompt.trim().slice(0, 500)
  if (!cleanPrompt) throw new Error('An image description is required.')
  const moderation = moderateText(cleanPrompt)
  if (!moderation.allowed) throw new Error(moderation.reason)
  await assertRuntimeCall(project.id, 'runtime_image')
  await assertCredits(project.ownerId, CREDIT_POLICY.image)
  await spendCredits(project.ownerId, project.id, 'runtime_image', CREDIT_POLICY.image)
  const dataUrl = await generateCreativeAsset(cleanPrompt, 'square')
  const asset = await storeDataUrlAsset({
    ownerId: project.ownerId,
    projectId: project.id,
    prompt: cleanPrompt,
    dataUrl,
  })
  return { url: asset.url, prompt: asset.prompt }
}
