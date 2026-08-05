import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync, mkdirSync } from 'fs'

config()
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const TABLES = [
  'users', 'projects', 'task_groups', 'tasks', 'task_assignees',
  'task_marks', 'files', 'comments', 'activity_log', 'activity_reads', 'notifications',
]

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
const dir = `backups/${stamp}`
mkdirSync(dir, { recursive: true })

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) { console.error(`✗ ${table}:`, error.message); continue }
  writeFileSync(`${dir}/${table}.json`, JSON.stringify(data, null, 2))
  console.log(`✓ ${table}: ${data.length} dòng`)
}
console.log(`\nBackup xong → ${dir}/`)
