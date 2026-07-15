# Vibe

Vibe is a five-minute creation engine for young makers. A student describes one wild idea and gets a polished, interactive product—not a coding tutorial or a chat transcript. Every successful build becomes a real, shareable website.

## What exists

- One-prompt first builds and prompt-based remixes
- Preact/TypeScript products compiled inside Cloudflare Workers
- A curated creative runtime: Motion, Three.js, Chart.js, Howler, Signals, date-fns, Marked, and Phosphor icons
- Up to three generated visual assets per build
- Scoped product APIs for structured data, text AI, and image AI
- Automatic checkpoints, restore, source editing, and rebuild
- Instantly shareable unlisted links; optional teacher-approved named domains
- Username/password accounts with no email or personal profile
- Teacher classes, join codes, review, and publish controls
- Daily credits, per-product runtime quotas, visitor write limits, moderation gates, and authentication throttling

## Architecture

The application runs as one Cloudflare Worker using the OpenNext adapter:

- **D1** stores users, classes, projects, source files, checkpoints, build state, capabilities, usage, and tiny app databases.
- **KV** stores immutable compiled websites and generated images.
- **Worker assets** ship the self-hosted package runtime; a pure-JavaScript compiler transforms generated TypeScript/JSX inside the Worker.
- **xAI or OpenRouter** generates source; **Google Imagen** generates artwork.
- Generated products receive only `window.vibe`, a capability-scoped runtime SDK. They cannot install packages, fetch arbitrary APIs through the platform, or access creator secrets.

## Local development

Requirements: Node.js 20+, npm, and a Cloudflare account authenticated with Wrangler.

```bash
npm install
cp .env.example .env.local
npm run cf:migrate:local
npm run dev
```

Open `http://localhost:3000`. Set `VIBE_FAKE_AI=1` for fast deterministic builds without model keys.

The project intentionally generates `public/runtime/vendor.js` during `prebuild`. Do not hand-edit it.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Production

Cloudflare resources are declared in `wrangler.jsonc`; schema changes live in `migrations/`. See [DEPLOYMENT.md](./DEPLOYMENT.md) for secrets, migrations, deployment, teacher provisioning, custom domains, and rollback.

## Product safety model

- Unlisted products are `noindex`; named public domains require teacher/admin approval.
- Generated apps are rendered in an opaque-origin iframe sandbox in the studio.
- Runtime data is schema-scoped, length-limited, moderated, quota-limited, and stripped of control characters.
- Generated sites receive restrictive CSP, permissions policy, MIME sniffing protection, and no camera/microphone/geolocation access.
- Session tokens are random, server-hashed, `httpOnly`, `sameSite=lax`, secure in production, and expire after seven days.
- Passwords use scrypt with per-user salts. Login and registration are rate-limited.
- API keys stay in Cloudflare encrypted secrets and are never bundled into generated products.

This is a strong beta safety baseline, not a replacement for school policy, teacher supervision, abuse reporting, or a formal privacy/security review before a large rollout.
