# Cloudflare deployment

Vibe is Cloudflare-native. The configured production stack uses one Worker, D1 for relational state, KV for compiled products/assets, and Worker static assets for the compiler/runtime.

## 1. Install and authenticate

```bash
npm install
npx wrangler whoami
```

If Wrangler is not authenticated, run `npx wrangler login` in an interactive terminal.

## 2. Infrastructure

This repository already declares the production D1 and KV resource IDs in `wrangler.jsonc`. For a new Cloudflare account, create replacements and update those IDs:

```bash
npx wrangler d1 create vibe-production
npx wrangler kv namespace create VIBE_ARTIFACTS
```

Apply every pending migration before deploying:

```bash
npm run cf:migrate:remote
```

## 3. Add encrypted AI secrets

In the Cloudflare dashboard, open **Workers & Pages → vibe → Settings → Variables and Secrets**. Add these as encrypted secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | Recommended | Primary source-generation and runtime text model |
| `OPENROUTER_API_KEY` | Optional | Text provider fallback when xAI is absent |
| `GOOGLE_AI_API_KEY` | Recommended | Build-time and runtime image generation |
| `RATE_LIMIT_SALT` | Recommended | Makes stored authentication rate-limit identifiers deployment-specific |
| `VISITOR_HASH_SALT` | Recommended | Makes anonymous runtime visitor hashes deployment-specific |

The command-line equivalent is:

```bash
npx wrangler secret put XAI_API_KEY
npx wrangler secret put GOOGLE_AI_API_KEY
npx wrangler secret put RATE_LIMIT_SALT
npx wrangler secret put VISITOR_HASH_SALT
```

Do not put secret values in `wrangler.jsonc`, `.env.example`, commits, build arguments, or `NEXT_PUBLIC_*` variables. Without a text-provider secret, Vibe deliberately produces a polished deterministic demo project so the deployment remains testable. Image features require Google AI.

Optional non-secret settings can be added to `vars` in `wrangler.jsonc`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BUILD_MODEL` | `grok-4.3` | Source-generation model |
| `RUNTIME_TEXT_MODEL` | `grok-4.3-mini` | Model exposed to approved product capabilities |
| `IMAGE_MODEL` | `imagen-4.0-fast-generate-001` | Imagen model |
| `DAILY_CREATOR_CREDITS` | `100` | Per-maker daily budget |
| `RUNTIME_TEXT_DAILY_LIMIT` | `50` | Text calls per product/day |
| `RUNTIME_IMAGE_DAILY_LIMIT` | `3` | Images per product/day |

Never set `VIBE_FAKE_AI=1` in production.

## 4. Deploy

```bash
npm run deploy
```

The command builds the self-hosted runtime, creates the Next.js production build, adapts it to Workers, and deploys it. The resulting `*.workers.dev` address supports accounts, building, D1/KV storage, and unlisted public links immediately.

The deploy wrapper temporarily hides local `.env*` files while producing the Worker bundle, restores them afterward, and passes `--keep-vars`. This prevents workstation keys from being compiled into an upload and preserves encrypted secrets managed in the Cloudflare dashboard.

## 5. Create or rotate a teacher

Use a unique username, a password of at least 12 characters, and a private class code:

```bash
npm run db:create-teacher -- \
  --username teacher_name \
  --password 'a-long-random-password' \
  --class-code 'private-class-code'
```

Running this again for the same username rotates its password and keeps it a teacher. The account page inside Vibe can also change the password. Students join with the class code, a username, and a password; no email address is collected.

## 6. Optional named public domains

Unlisted `/p/<token>/` links need no custom domain. To enable teacher-approved addresses such as `project.example.com`:

1. Put the zone on Cloudflare.
2. Route both the root host and `*.example.com/*` to the `vibe` Worker.
3. Add `ROOT_DOMAIN=example.com` as a Worker variable.
4. Redeploy and test an approved project.

Until `ROOT_DOMAIN` is configured, the approval API stays disabled instead of issuing broken links.

## Operations

Back up D1:

```bash
npm run db:backup
```

Review logs:

```bash
npx wrangler tail vibe
```

List deployments and roll back from **Workers & Pages → vibe → Deployments** in the Cloudflare dashboard. Database migrations are forward-only; export D1 before destructive schema changes.

## Release checklist

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- `npm audit` has no high or critical vulnerabilities.
- D1 migrations are current.
- AI keys exist only as encrypted Worker secrets.
- A fresh student can register with the intended class code.
- A build reaches 100%, its unlisted link opens while signed out, and the studio iframe cannot read authenticated APIs.
- Teacher password is rotated after handoff.
- Credit limits and model spend alerts match the rollout size.
