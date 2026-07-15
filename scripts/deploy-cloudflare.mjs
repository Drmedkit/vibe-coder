import { existsSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const action = process.argv[2] === 'upload' ? 'upload' : 'deploy'
const localEnvFiles = ['.env', '.env.local', '.env.production', '.env.production.local']
const moved = []

function run(args) {
  const result = spawnSync('npx', args, { cwd: process.cwd(), stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${args.join(' ')} exited with code ${result.status}`)
}

try {
  for (const name of localEnvFiles) {
    const source = path.join(process.cwd(), name)
    if (!existsSync(source)) continue
    const backup = path.join(process.cwd(), `.vibe-local-only-${process.pid}-${name.slice(1)}`)
    renameSync(source, backup)
    moved.push({ source, backup })
  }
  console.log('Local .env files are excluded from the Cloudflare bundle; production secrets stay in Worker settings.')
  run(['opennextjs-cloudflare', 'build'])
  run(action === 'deploy'
    ? ['opennextjs-cloudflare', 'deploy', '--', '--keep-vars']
    : ['opennextjs-cloudflare', 'upload'])
} finally {
  for (const { source, backup } of moved.reverse()) {
    if (existsSync(backup)) renameSync(backup, source)
  }
}
