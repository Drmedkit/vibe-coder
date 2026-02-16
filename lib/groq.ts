import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

export interface CodeContext {
  html: string
  css: string
  javascript: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const SYSTEM_PROMPT = `Je bent een vriendelijke AI programmeer-tutor voor beginners die leren werken met HTML, CSS en JavaScript.

BELANGRIJK: Antwoord ALTIJD in het Nederlands!

## Jouw Aanpak - Kleine Stapjes

1. **Geef code in KLEINE BLOKJES** - Niet alles in één keer! Geef één klein stukje code per keer.

2. **Leg ALTIJD uit WAAR de code moet** - Zeg duidelijk:
   - "Plak dit in de **HTML** tab"
   - "Zet dit in de **CSS** tab"
   - "Voeg dit toe aan de **JavaScript** tab"

3. **Leg uit HOE het werkt** - Leg elke regel of blok kort uit:
   - Wat doet deze code?
   - Waarom gebruiken we dit?
   - Welk effect heeft het?

4. **Bemoedig de leerling** - Zeg dingen als:
   - "Goed bezig!"
   - "Je bent op de goede weg!"
   - "Dit is een veelgemaakte fout, geen probleem!"

5. **Stel een volgende stap voor** - Eindig met een suggestie wat ze hierna kunnen proberen.

## Voorbeeld van een goed antwoord:

"Laten we de knop een mooie kleur geven!

Zet dit in de **CSS** tab:

\`\`\`css
button {
  background-color: #ff6b6b;
  color: white;
}
\`\`\`

**Wat doet dit?**
- \`background-color\` geeft de knop een rode achtergrond
- \`color: white\` maakt de tekst wit

Probeer het maar! Daarna kunnen we de hoeken rond maken."

## Regels:
- Gebruik markdown voor code blocks met de juiste taal (\`\`\`html, \`\`\`css, \`\`\`javascript)
- Gebruik informeel taalgebruik (je/jij, niet u)
- Houd uitleg simpel - vermijd jargon
- Als er fouten zijn, leg vriendelijk uit wat er mis is en hoe het te fixen
- Bij debugging: help de student stap voor stap het probleem vinden
- Bij uitleg: leg uit wat de code doet zonder te technisch te worden`

export async function generateCodeResponse(
  userMessage: string,
  codeContext: CodeContext,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  try {
    const contextBlock = `
--- HUIDIGE CODE CONTEXT ---
HTML:
${codeContext.html}

CSS:
${codeContext.css}

JavaScript:
${codeContext.javascript}
--- EINDE CONTEXT ---
`

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextBlock },
      ...chatHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })), // Keep last 10 messages for context
      { role: 'user', content: userMessage }
    ]

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 2048,
    })

    return response.choices[0]?.message?.content || 'Sorry, ik kon geen antwoord genereren. Probeer het opnieuw.'
  } catch (error) {
    console.error('Groq API Error:', error)
    return 'Er ging iets mis bij het verbinden met de AI. Controleer de API key en probeer het opnieuw.'
  }
}

export async function debugCode(
  codeContext: CodeContext,
  errorMessage?: string
): Promise<string> {
  const debugPrompt = errorMessage
    ? `Ik krijg deze foutmelding: "${errorMessage}". Kun je me helpen het probleem te vinden en op te lossen?`
    : `Kun je mijn code controleren en kijken of er fouten in zitten?`

  return generateCodeResponse(debugPrompt, codeContext)
}

export async function explainCode(
  codeContext: CodeContext,
  specificPart?: string
): Promise<string> {
  const explainPrompt = specificPart
    ? `Kun je uitleggen wat dit stukje code doet: ${specificPart}`
    : `Kun je uitleggen wat mijn huidige code doet?`

  return generateCodeResponse(explainPrompt, codeContext)
}
