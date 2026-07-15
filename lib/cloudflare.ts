import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function cloudflareEnv(): Promise<CloudflareEnv> {
  const context = await getCloudflareContext({ async: true })
  return context.env
}

export async function cloudflareExecutionContext(): Promise<ExecutionContext | null> {
  try {
    const context = await getCloudflareContext({ async: true })
    return context.ctx
  } catch {
    return null
  }
}

export async function getDatabase(): Promise<D1Database> {
  return (await cloudflareEnv()).DB
}

export async function getArtifactStore(): Promise<KVNamespace> {
  return (await cloudflareEnv()).VIBE_ARTIFACTS
}
