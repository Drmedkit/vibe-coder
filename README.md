# Vibe Coder

Een Nederlandse classroom tool voor studenten die webpagina's en kleine games willen bouwen met AI-begeleiding.

## Wat studenten kunnen

- Account maken met gebruikersnaam en wachtwoord, zonder e-mail.
- Registreren met de vaste klascode `h20`.
- Bouwen met HTML, CSS en JavaScript in een browser-editor.
- Live preview bekijken met JavaScript foutmeldingen.
- AI gebruiken in drie modi: Plan, Build en Explain. Plan is een gesprek met vragen en opties, niet een automatisch eindplan.
- AI-codevoorstellen eerst bekijken en daarna zelf toepassen.
- Projecten handmatig opslaan, openen, kopieren en verwijderen.
- Projecten importeren/exporteren als JSON.
- Game assets genereren met AI en gebruiken in de chat of HTML.

## Tech stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Prisma 7 met PostgreSQL
- OpenRouter voor chatmodellen
- Google Imagen via Google AI Studio voor assets
- CodeMirror 6 voor de editor

## Lokaal draaien

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open daarna `http://localhost:3000`.

## Environment variables

```bash
DATABASE_URL="postgresql://user:pass@host/db"
POSTGRES_PRISMA_URL="postgresql://user:pass@host/db"
OPENROUTER_API_KEY="sk-or-v1-..."
GOOGLE_AI_API_KEY="AIza..."
CLASS_CODE="h20"
```

`CLASS_CODE` staat in de app bewust vast op `h20`; de variable blijft in het voorbeeld staan voor documentatie.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```
