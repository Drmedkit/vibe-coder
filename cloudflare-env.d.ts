/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  VIBE_ARTIFACTS: KVNamespace
  DB: D1Database
  ASSETS: Fetcher
  WORKER_SELF_REFERENCE: Fetcher
  NEXTJS_ENV: string
  NEXT_PUBLIC_PRODUCT_NAME: string
  XAI_API_KEY?: string
  OPENROUTER_API_KEY?: string
  GOOGLE_AI_API_KEY?: string
  RATE_LIMIT_SALT?: string
  VISITOR_HASH_SALT?: string
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}
