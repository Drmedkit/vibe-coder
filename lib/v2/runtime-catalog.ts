export const RUNTIME_PACKAGES = [
  'preact',
  'preact/hooks',
  'preact/jsx-runtime',
  '@preact/signals',
  'motion',
  'motion/react',
  '@phosphor-icons/react',
  'three',
  'chart.js',
  'howler',
  'date-fns',
  'marked',
] as const

export function isAllowedImport(specifier: string): boolean {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return true
  return (RUNTIME_PACKAGES as readonly string[]).includes(specifier)
}

export const RUNTIME_GUIDE = `
The app runtime is Preact with TypeScript. The entry component must be src/App.tsx and export default App.
Use src/styles.css for all styles. You may add small local modules under src/.

Allowed imports:
- preact and preact/hooks
- @preact/signals
- motion and motion/react
- @phosphor-icons/react
- three
- chart.js
- howler
- date-fns
- marked

The platform SDK is available as window.vibe:
- await window.vibe.data.list(collection)
- await window.vibe.data.create(collection, record)
- await window.vibe.data.update(collection, id, patch)
- await window.vibe.data.increment(collection, id, field, amount)
- await window.vibe.ai.text(prompt)
- await window.vibe.ai.image(prompt)

Do not fetch arbitrary external URLs. Do not use emojis. Do not request secrets. Do not add server code.
Use generated asset placeholders as asset://KEY. The builder replaces these with hosted URLs.
Make the first screen immediately useful and visually complete at 360px and 1280px widths.
`
