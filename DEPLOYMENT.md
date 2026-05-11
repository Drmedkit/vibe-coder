# Vibe Coder deployment

## Vercel setup

1. Maak een Vercel project aan vanuit de GitHub repository.
2. Voeg een PostgreSQL database toe, bijvoorbeeld Neon.
3. Zet de environment variables:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PRISMA_URL` | PostgreSQL connection string for Prisma |
| `OPENROUTER_API_KEY` | Chat AI via OpenRouter |
| `GOOGLE_AI_API_KEY` | Image generation via Google AI Studio |
| `CLASS_CODE` | Documentatie/default: `h20` |

4. Deploy met de build command:

```bash
npm run build
```

5. Run database migrations:

```bash
npx prisma migrate deploy
```

## Student access

Students register with:

- class code: `h20`
- username
- password

No email or recovery flow exists. If a password is lost, the student starts over or the teacher handles it outside the app.

## Production checks

Before deploy:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```
