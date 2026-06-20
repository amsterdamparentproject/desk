import { cookies } from 'next/headers'
import { verifyDeskToken } from '@/app/utils/auth-gate'
import { getSources } from '@/app/actions/sources'
import { SourcesClient } from './SourcesClient'

export default async function SourcesPage() {
  const cookieStore = await cookies()
  const isAuthorized = verifyDeskToken(cookieStore)

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mb-4">
            🔒
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Desk Workspace Locked</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
            This workspace requires a valid device token parameter to access backend records.
          </p>
        </div>
      </div>
    )
  }

  const sources = await getSources()
  return <SourcesClient initialSources={sources} />
}
