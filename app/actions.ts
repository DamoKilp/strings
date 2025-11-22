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
  
  // Validate input
  if (!email || !password) {
    return redirect(buildRedirectUrl('/sign-in', { error: 'Email and password are required' }))
  }

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[SignIn] Missing Supabase environment variables')
    return redirect(buildRedirectUrl('/sign-in', { error: 'Server configuration error. Please contact support.' }))
  }

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
    // Provide more helpful error messages
    let errorMessage = error.message
    if (error.message.includes('Invalid login credentials')) {
      errorMessage = 'Invalid email or password. Please check your credentials and try again.'
    } else if (error.message.includes('Email not confirmed')) {
      errorMessage = 'Please check your email and confirm your account before signing in.'
    } else if (error.message.includes('Too many requests')) {
      errorMessage = 'Too many login attempts. Please wait a moment and try again.'
    }
    console.error('[SignIn] Authentication error:', error.message)
    return redirect(buildRedirectUrl('/sign-in', { error: errorMessage }))
  }

  // Success - redirect to destination
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


export const signOutAction = async () => {
  const supabase = await createClient()
  try {
    await supabase.auth.signOut()
  } catch (error) {
    // Log but don't throw - sign-out should always succeed from user perspective
    console.error('Sign out error (non-critical):', error)
  }
  // Redirect to sign-in page
  redirect('/sign-in')
}



