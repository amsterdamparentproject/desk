// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { DeskNav } from './components/DeskNav'
import { ServiceWorkerRegistration } from './components/ServiceWorkerRegistration'
import { verifyDeskToken } from './utils/auth-gate'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
  const isLoggedIn = verifyDeskToken(cookieStore)

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-white min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <DeskNav isLoggedIn={isLoggedIn} />
        {children}
      </body>
    </html>
  )
}