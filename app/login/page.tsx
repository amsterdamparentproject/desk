import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskSession } from '@/app/utils/auth-gate'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies()
  if (verifyDeskSession(cookieStore)) redirect('/')

  const { error } = await searchParams

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center bg-surface p-8 rounded-3xl border-2 border-lamp-glow shadow-[0_0_0_5px_rgba(227,45,212,0.13),0_0_52px_rgba(227,45,212,0.3)]">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-300 mb-4">
          🔒
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Sign in to Desk
        </h1>
        <p className="text-sm text-slate-500 mt-2 mb-6 max-w-xs mx-auto">
          Enter the team password to access the workspace.
        </p>
        <form action="/api/login" method="post" className="space-y-3 text-left">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-app-gold"
          />
          {error && (
            <p className="text-xs text-red-300">
              Incorrect password. Please try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-lamp-glow text-ink font-display text-sm font-extrabold py-2.5 shadow-[0_0_30px_rgba(227,45,212,0.5)] hover:brightness-110 transition"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
