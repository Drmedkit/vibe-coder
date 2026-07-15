import { describe, expect, it } from 'vitest'
import { compileProject, validateSourceFiles } from '../compiler'

describe('Cloudflare-safe project compiler', () => {
  it('transforms TypeScript, JSX, local modules, and curated packages without WebAssembly', async () => {
    const artifacts = await compileProject({
      title: 'Tiny machine',
      deploymentToken: 'test-token',
      files: [
        {
          path: 'src/App.tsx',
          content: `import { useState } from 'preact/hooks'; import { label } from './label';
export default function App() { const [count, setCount] = useState<number>(0); return <button onClick={() => setCount(count + 1)}>{label}: {count}</button> }`,
        },
        { path: 'src/label.ts', content: `export const label: string = 'Launch';` },
        { path: 'src/styles.css', content: 'button { color: tomato; }' },
      ],
    })
    expect(artifacts.map(file => file.name)).toEqual(['index.html', 'app.js', 'app.css', 'sdk.js'])
    const script = String(artifacts.find(file => file.name === 'app.js')?.body)
    expect(script).toContain('useState')
    expect(script).not.toContain('WebAssembly')
  })

  it('rejects imports outside the curated runtime', () => {
    expect(() => validateSourceFiles([{ path: 'src/App.tsx', content: `import axios from 'axios'; export default function App(){ return null }` }]))
      .toThrow('Package not allowed: axios')
  })

  it('rejects dynamic module loading', () => {
    expect(() => validateSourceFiles([{ path: 'src/App.tsx', content: `const later = import('./later'); export default function App(){ return null }` }]))
      .toThrow('Dynamic module loading is not supported')
  })

  it.each([
    [`localStorage.setItem('x', 'y')`, 'Browser identity storage is not available'],
    [`fetch('https://example.com')`, 'Direct network access is not available'],
    [`new Function('return 1')()`, 'Dynamic code execution is not available'],
  ])('rejects unsafe browser escape hatches', (source, message) => {
    expect(() => validateSourceFiles([{ path: 'src/App.tsx', content: `${source}; export default function App(){ return null }` }]))
      .toThrow(message)
  })
})
