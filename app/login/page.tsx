import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { login } from '@/app/actions/auth'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies()
  if (verifyDeskSession(cookieStore)) redirect('/')

  const { error } = await searchParams

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mb-4">
          🔒
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to Desk</h1>
        <p className="text-sm text-slate-500 mt-2 mb-6 max-w-xs mx-auto">
          Enter the team password to access the workspace.
        </p>
        <form action={login} className="space-y-3 text-left">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-app-gold"
          />
          {error && (
            <p className="text-xs text-red-600">Incorrect password. Please try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-black text-white text-sm font-medium py-2 hover:bg-black/90 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
