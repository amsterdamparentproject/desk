import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { getSources } from '@/app/actions/sources'
import { SourcesClient } from './SourcesClient'

export default async function SourcesPage() {
  const cookieStore = await cookies()
  const isAuthorized = verifyDeskSession(cookieStore)

  if (!isAuthorized) {
    redirect('/login')
  }

  const sources = await getSources()
  return <SourcesClient initialSources={sources} />
}
