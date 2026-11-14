// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { DM_Mono, DM_Sans, Unbounded } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { DeskNav } from './components/DeskNav'
import { ServiceWorkerRegistration } from './components/ServiceWorkerRegistration'
import { verifyDeskSession } from './utils/auth-gate'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

const unbounded = Unbounded({
  variable: '--font-unbounded',
  subsets: ['latin'],
  weight: ['500', '700', '800'],
})

export const viewport: Viewport = {
  themeColor: '#231f21',
}

export const metadata: Metadata = {
  title: 'The APP Desk',
  description: 'Powering Amsterdam Parent Project',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const isLoggedIn = verifyDeskSession(cookieStore)

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="bg-base h-full flex flex-col">
        <ServiceWorkerRegistration />
        <DeskNav isLoggedIn={isLoggedIn} />
        {children}
      </body>
    </html>
  )
}
