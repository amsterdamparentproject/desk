import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskToken } from '@/app/utils/auth-gate'
import { captureFromShare } from '@/app/actions/activities'

interface SharePageProps {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const cookieStore = await cookies()
  if (!verifyDeskToken(cookieStore)) redirect('/')

  const { title = '', text = '', url = '' } = await searchParams

  async function capture() {
    'use server'
    await captureFromShare({ url, title, text })
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-600 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Capture to Ideas</p>
          <p className="text-white font-bold text-lg leading-tight mt-1 truncate">{title || url || 'Shared link'}</p>
        </div>

        {url && (
          <div className="px-6 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-400 truncate">{url}</p>
          </div>
        )}

        {text && (
          <div className="px-6 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-600 line-clamp-3">{text}</p>
          </div>
        )}

        <div className="px-6 py-5">
          <form action={capture}>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Capture
            </button>
          </form>
          <a
            href="/"
            className="block mt-3 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel
          </a>
        </div>
      </div>
    </div>
  )
}
