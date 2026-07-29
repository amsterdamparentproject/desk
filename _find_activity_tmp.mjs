import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'activities' }
})

for (const table of ['events', 'resources']) {
  const { data, error } = await supabase
    .from(table)
    .select('id, title, list_id, status, services, postpartum_post, start_date, repeat_rrule, repeat_next_date, organization, updated_at, created_at')
    .ilike('title', '%August%Match%')
  if (error) console.error(table, 'error:', error.message)
  else console.log(table, JSON.stringify(data, null, 2))
}

// Broader fallback search in case the title doesn't literally contain "August Match"
for (const table of ['events', 'resources']) {
  const { data, error } = await supabase
    .from(table)
    .select('id, title, list_id, status, services, postpartum_post, updated_at')
    .ilike('title', '%Postpartum Post%')
  if (!error) console.log(table, '(Postpartum Post title match)', JSON.stringify(data, null, 2))
}
