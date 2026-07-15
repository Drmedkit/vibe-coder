import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1])
}

const username = (args.get('--username') || '').trim().toLowerCase()
const password = args.get('--password') || ''
const classCode = (args.get('--class-code') || '').trim().toLowerCase()
const local = process.argv.includes('--local')

if (!/^[a-z0-9_-]{3,24}$/.test(username) || password.length < 12 || !/^[a-z0-9-]{5,32}$/.test(classCode)) {
  console.error('Usage: npm run db:create-teacher -- --username NAME --password LONG_PASSWORD --class-code JOIN-CODE [--local yes]')
  process.exit(1)
}

const escapeSql = value => value.replaceAll("'", "''")
const id = `user_${randomUUID().replaceAll('-', '')}`
const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
const timestamp = new Date().toISOString()
const sql = `
INSERT INTO users (id, username, password_hash, password_salt, role, created_at, updated_at, last_login_at)
VALUES ('${id}', '${escapeSql(username)}', '${hash}', '${salt}', 'teacher', '${timestamp}', '${timestamp}', NULL)
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt,
role = 'teacher', updated_at = excluded.updated_at;
UPDATE classes SET owner_id = (SELECT id FROM users WHERE username = '${escapeSql(username)}'),
join_code = '${escapeSql(classCode)}', updated_at = '${timestamp}' WHERE id = 'class_default';
`

const command = ['wrangler', 'd1', 'execute', 'DB', local ? '--local' : '--remote', '--command', sql]
const result = spawnSync('npx', command, { stdio: 'inherit', shell: false })
process.exit(result.status ?? 1)
