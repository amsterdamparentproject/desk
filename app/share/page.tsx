import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskToken } from '@/app/utils/auth-gate'
import { ShareForm } from './ShareForm'

interface SharePageProps {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const cookieStore = await cookies()
  if (!verifyDeskToken(cookieStore)) redirect('/')

  const { title = '', text = '', url = '' } = await searchParams

  const initialDescription = [title, url, text].filter(Boolean).join('\n')

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md space-y-3">
        <div className="px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capture to Ideas</p>
        </div>
        <ShareForm initialDescription={initialDescription} url={url} title={title} />
        <a
          href="/"
          className="block text-center text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1"
        >
          Cancel
        </a>
      </div>
    </div>
  )
}
