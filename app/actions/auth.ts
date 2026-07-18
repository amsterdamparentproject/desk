'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_NAME, COOKIE_MAX_AGE } from '@/app/utils/auth-gate'

export async function login(formData: FormData) {
  const password = (formData.get('password') as string) ?? ''
  const secret = process.env.DESK_PASSWORD

  if (!secret || password !== secret) {
    redirect('/login?error=1')
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect('/login')
}
