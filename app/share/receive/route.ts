import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyDeskToken } from '@/app/utils/auth-gate'
import { createAdminClient } from '@/app/utils/supabase/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyDeskToken(cookieStore)) {
    return NextResponse.redirect(new URL('/', request.url), 303)
  }

  const formData = await request.formData()
  const title = (formData.get('title') as string) ?? ''
  const text = (formData.get('text') as string) ?? ''
  const url = (formData.get('url') as string) ?? ''
  const fileEntry = formData.get('file')
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null

  const params = new URLSearchParams()
  if (title) params.set('title', title)
  if (text) params.set('text', text)
  if (url) params.set('url', url)

  if (file) {
    const id = crypto.randomUUID()
    const supabase = createAdminClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
    const path = `${id}/${safeName}`

    const { error } = await supabase.storage
      .from('activities')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (!error) {
      const fileUrl = supabase.storage.from('activities').getPublicUrl(path).data.publicUrl
      params.set('file_url', fileUrl)
      params.set('file_id', id)
    }
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  // 303 forces the browser to follow up with a GET. The default (307) preserves
  // the POST method, which would re-POST to the /share page and make Next.js
  // treat it as a Server Action call → "Failed to find Server Action".
  return NextResponse.redirect(new URL(`/share?${params.toString()}`, `${proto}://${host}`), 303)
}
