# Vibe Coder - Vercel Deployment Guide

## Secrets Setup op Vercel

### Stap 1: Maak een Vercel Account
1. Ga naar [vercel.com](https://vercel.com)
2. Sign up met GitHub
3. Klik op "Import Project"

### Stap 2: Connect GitHub Repository
1. Push je code naar GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/JOUW-USERNAME/vibe-coder.git
   git push -u origin main
   ```

2. Importeer het project in Vercel

### Stap 3: Database Setup (Neon PostgreSQL)
1. Ga in Vercel naar je project → "Storage" tab
2. Klik "Create Database" → Kies "Postgres" (powered by Neon)
3. Vercel maakt automatisch de `DATABASE_URL` environment variable aan

### Stap 4: API Keys Toevoegen

Ga naar je Vercel project → Settings → Environment Variables

Voeg toe:

| Name | Value | Waar krijg je dit? |
|------|-------|-------------------|
| `GROQ_API_KEY` | `gsk_...` | [console.groq.com](https://console.groq.com) |
| `FAL_KEY` | `fal_...` | [fal.ai/dashboard](https://fal.ai/dashboard) |
| `NEXTAUTH_SECRET` | `random-string` | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://jouw-app.vercel.app` | Je Vercel URL |

**Let op:** DATABASE_URL wordt automatisch aangemaakt door Vercel Storage!

### Stap 5: Deploy Database Schema
Na deployment, run dit ONE TIME in de Vercel dashboard terminal of lokaal:

```bash
npx prisma migrate deploy
```

Of in Vercel Dashboard → Settings → Functions → Add this build command:
```bash
npm run build && npx prisma generate
```

## Lokaal Testen met Production Database

Update je lokale `.env`:
```bash
# Kopieer DATABASE_URL van Vercel → Settings → Environment Variables
DATABASE_URL="postgresql://user:pass@host.neon.tech/..."
GROQ_API_KEY="gsk_..."
FAL_API_KEY="fal_..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="local-dev-secret"
```

Dan run:
```bash
npx prisma migrate dev
npm run dev
```

## Security Checklist ✅

- [ ] .env is in .gitignore (✓ al gedaan)
- [ ] API keys NOOIT in code hardcoded
- [ ] Environment variables in Vercel Dashboard toegevoegd
- [ ] Database URL gebruikt van Vercel Storage
- [ ] NEXTAUTH_SECRET is een random string
- [ ] NEXTAUTH_URL is je production URL

## Studenten Toegang

Studenten gebruiken gewoon: `https://jouw-app.vercel.app`

**Ze hoeven GEEN API keys!** Alle keys zitten server-side veilig opgeslagen.

## Kosten Schatting (30 studenten)

| Service | Free Tier | Kosten voor 30 studenten |
|---------|-----------|--------------------------|
| Vercel | 100GB bandwidth | Gratis |
| Neon DB | 10GB storage | Gratis |
| Groq API | 14,400 req/dag | Gratis |
| FAL.ai Images | 100/maand | ~€0.60 |

**Totaal: ~€0.60/maand** 🎉
