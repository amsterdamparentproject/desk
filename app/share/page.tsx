import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { LavaLamp } from '@/app/components/Lava'
import { ShareForm } from './ShareForm'

interface SharePageProps {
  searchParams: Promise<{
    title?: string
    text?: string
    url?: string
    file_url?: string
    file_id?: string
  }>
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const cookieStore = await cookies()
  if (!verifyDeskSession(cookieStore)) redirect('/login')

  const {
    title = '',
    text = '',
    url = '',
    file_url = '',
    file_id = '',
  } = await searchParams

  const initialDescription = [title, url, text].filter(Boolean).join('\n')

  return (
    <div className="flex min-h-[100dvh] items-start justify-center px-4 pb-10 pt-8">
      <div className="w-full max-w-md space-y-5">
        <header className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full bg-lamp-glow/40 blur-2xl" />
            <LavaLamp
              width={44}
              height={92}
              glow="#e32dd4"
              glowOpacity={0.8}
              label="Lava lamp"
            />
          </div>
          <div>
            <h1 className="font-display text-base font-extrabold leading-snug text-app-gold">
              Bubble, bubble, toil, and trouble…
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Something bubbled up? Capture it now.
            </p>
          </div>
        </header>
        <ShareForm
          initialDescription={initialDescription}
          url={url}
          title={title}
          initialFileUrl={file_url || null}
          initialFileId={file_id || null}
        />
        <Link
          href="/"
          className="block pt-1 text-center text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
