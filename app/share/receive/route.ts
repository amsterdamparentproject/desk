import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyDeskToken } from '@/app/utils/auth-gate'
import { createAdminClient } from '@/app/utils/supabase/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyDeskToken(cookieStore)) {
    return NextResponse.redirect(new URL('/', request.url))
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

  return NextResponse.redirect(new URL(`/share?${params.toString()}`, request.url))
}
