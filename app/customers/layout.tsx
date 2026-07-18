import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeskSession } from '@/app/utils/auth-gate'

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isAuthorized = verifyDeskSession(cookieStore)

  if (!isAuthorized) {
    redirect('/login')
  }

  return <>{children}</>
}
