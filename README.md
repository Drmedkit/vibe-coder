# Vibe Coder 🎨

Een web-based code editor voor studenten om HTML, CSS en JavaScript te leren met AI hulp.

## Features

- ✅ **Live Code Editor** - HTML, CSS, JavaScript tabs
- ✅ **Real-time Preview** - Zie je code direct in actie
- ✅ **AI Assistent** - Groq-powered chat voor code hulp (Nederlands)
- ✅ **Image Generator** - Maak game assets met AI (FAL.ai)
- ✅ **Download/Upload** - Projecten opslaan als JSON
- 🚧 **User Accounts** - Opslaan in database (komt binnenkort)
- 🚧 **Classroom Mode** - Voor docenten (komt binnenkort)
- 🚧 **Community Gallery** - Projecten delen en forken (komt binnenkort)

## Lokaal Draaien

1. **Clone het project**
   ```bash
   git clone <repository-url>
   cd vibe-coder
   ```

2. **Installeer dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Vul je API keys in in .env
   ```

4. **Setup database**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

## API Keys Krijgen

- **Groq** (AI Chat): [console.groq.com](https://console.groq.com/keys)
- **FAL.ai** (Images): [fal.ai/dashboard](https://fal.ai/dashboard/keys)

## Deployment naar Vercel

Zie [DEPLOYMENT.md](./DEPLOYMENT.md) voor volledige instructies.

Snel overzicht:
1. Push naar GitHub
2. Importeer in Vercel
3. Voeg Neon Postgres database toe in Vercel Storage
4. Voeg environment variables toe in Vercel Settings
5. Deploy!

## Tech Stack

- **Framework**: Next.js 14 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Prisma + PostgreSQL (Neon)
- **AI**: Groq (Llama 3.3 70B)
- **Images**: FAL.ai (Flux Schnell)
- **Icons**: Lucide React

## Kosten (30 studenten)

- Vercel: **Gratis** (Hobby plan)
- Neon DB: **Gratis** (Free tier)
- Groq API: **Gratis** (14,400 requests/dag)
- FAL.ai: **~€0.60/maand** (na 100 gratis images)

**Totaal: ~€0.60/maand** 🎉

## Licentie

MIT
