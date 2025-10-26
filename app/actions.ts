'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export type EncodedMessage = { success: string } | { error: string } | { message: string }

function buildRedirectUrl(path: string, msg?: EncodedMessage) {
  try {
    const url = new URL(path, 'http://localhost')
    if (msg) {
      const key = 'success' in msg ? 'success' : 'error' in msg ? 'error' : 'message'
      const value = msg[key]
      url.searchParams.set(key, value)
    }
    return url.pathname + url.search
  } catch {
    return path
  }
}

export const signInAction = async (formData: FormData) => {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const headersList = await headers()
  const referer = headersList.get('referer') || ''
  let redirectTo: string | null = null
  try {
    const url = new URL(referer)
    redirectTo = url.searchParams.get('redirect_to')
  } catch {}

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return redirect(buildRedirectUrl('/sign-in', { error: error.message }))
  }

  const destination = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/'
  return redirect(destination)
}

export const signUpAction = async (formData: FormData) => {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return redirect(buildRedirectUrl('/sign-in', { error: error.message }))
  }

  return redirect(buildRedirectUrl('/sign-in', { success: 'Check your email to confirm your account!' }))
}



