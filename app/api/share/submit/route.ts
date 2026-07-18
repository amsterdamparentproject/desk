import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { createAdminClient } from '@/app/utils/supabase/server'
import { postDesk } from '@/lib/PostToWebhook'
import type { ListId } from '@/app/types/list'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyDeskSession(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  let title = '', description = '', url = '', type: 'event' | 'resource' = 'event'
  let use_ai = true, preloadedId: string | null = null, preloadedFileUrl: string | null = null
  let pendingFile: File | null = null

  if (contentType.startsWith('multipart/form-data')) {
    const formData = await request.formData()
    title = (formData.get('title') as string) ?? ''
    description = (formData.get('description') as string) ?? ''
    url = (formData.get('url') as string) ?? ''
    type = ((formData.get('type') as string) === 'resource' ? 'resource' : 'event')
    use_ai = (formData.get('use_ai') as string) !== 'false'
    preloadedId = (formData.get('id') as string) || null
    preloadedFileUrl = (formData.get('file_url') as string) || null
    const fileEntry = formData.get('file')
    pendingFile = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
  } else {
    const body = await request.json()
    title = body.title ?? ''
    description = body.description ?? ''
    url = body.url ?? ''
    type = body.type === 'resource' ? 'resource' : 'event'
    use_ai = body.use_ai !== false
    preloadedId = body.id ?? null
    preloadedFileUrl = body.file_url ?? null
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const id = preloadedId ?? crypto.randomUUID()
  const list_id: ListId = use_ai ? 'ideas' : 'review'
  const status = use_ai ? 'processing' : 'new'
  const table = type === 'event' ? 'events' : 'resources'

  let file_url = preloadedFileUrl

  if (pendingFile) {
    const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
    const path = `${id}/${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('activities')
      .upload(path, pendingFile, { contentType: pendingFile.type, upsert: true })
    if (!uploadError) {
      file_url = supabase.storage.from('activities').getPublicUrl(path).data.publicUrl
    }
  }

  const insert: Record<string, unknown> = {
    id,
    title: title || url || description.trim() || '(Shared content)',
    description,
    newsletter_description: '',
    url: url || null,
    list_id,
    status,
    source: 'app_desk',
    created_at: now,
    updated_at: now,
    ...(file_url ? { file_url } : {}),
  }
  if (type === 'event') insert.start_date = today

  const { error } = await supabase.from(table).insert(insert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (use_ai) {
    postDesk({
      description,
      file: null,
      list_id,
      use_ai: true,
      type,
      id,
      action: 'add',
    }).catch(err => console.error('Share webhook failed:', err))
  }

  return NextResponse.json({ id })
}
