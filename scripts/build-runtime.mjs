import { build } from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = path.join(process.cwd(), 'public', 'runtime')
await mkdir(outputDirectory, { recursive: true })
await rm(path.join(outputDirectory, 'esbuild.wasm'), { force: true })

await build({
  entryPoints: [path.join(process.cwd(), 'lib', 'v2', 'vendor-entry.ts')],
  outfile: path.join(outputDirectory, 'vendor.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  alias: {
    react: 'preact/compat',
    'react-dom': 'preact/compat',
    'react-dom/client': 'preact/compat',
  },
  define: { 'process.env.NODE_ENV': '"production"' },
})
