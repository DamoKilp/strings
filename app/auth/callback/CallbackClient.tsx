'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase/client'

const PKCE_HELP_MESSAGE =
  'Authentication link expired or was opened in a different browser window. Please request a new link from the same browser where you signed in.'

const EMAIL_OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']
const EMAIL_OTP_TYPE_SET = new Set<EmailOtpType>(EMAIL_OTP_TYPES)

function isPkceVerifierError(message?: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('code verifier') || normalized.includes('pkce')
}

function toEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase() as EmailOtpType
  return EMAIL_OTP_TYPE_SET.has(trimmed) ? trimmed : null
}

function hasCodeVerifierCookie() {
  if (typeof document === 'undefined') return null
  const matcher = /sb-[^=]+-code-verifier=/
  return matcher.test(document.cookie)
}

export default function CallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const finalize = async () => {
      if (cancelled) return
      setStatus('processing')

      try {
        const redirectTo = searchParams.get('redirect_to') || ''
        const from = searchParams.get('from') || ''
        const queryType = searchParams.get('type') || ''
        const code = searchParams.get('code')
        const recoveryToken = searchParams.get('token')
        const recoveryType = searchParams.get('type')

        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        const hashParams = hash && hash.length > 1 ? new URLSearchParams(hash.slice(1)) : null

        try {
          const searchKeys = Array.from(searchParams.keys())
          const hashKeys = hashParams ? Array.from(hashParams.keys()) : []
          console.debug(
            '[AuthCallback] start',
            `path=${typeof window !== 'undefined' ? window.location.pathname : ''}`,
            `hasHash=${!!hashParams}`,
            `searchKeys=${searchKeys.join(',')}`,
            `hashKeys=${hashKeys.join(',')}`
          )
        } catch {}

        if (hashParams) {
          const error = hashParams.get('error')
          const errorDesc = hashParams.get('error_description')
          if (error) {
            console.debug('[AuthCallback] hash error:', error)
            setStatus('error')
            setMessage(errorDesc || error)
            router.replace(`/sign-in?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDesc || 'Authentication link is invalid or has expired')}`)
            return
          }
          const access_token = hashParams.get('access_token') || ''
          const refresh_token = hashParams.get('refresh_token') || ''
          const hashType = hashParams.get('type') || ''
          if (hashType) {
            console.debug('[AuthCallback] hash type:', hashType)
          }
          if (access_token && refresh_token) {
            console.debug('[AuthCallback] setSession from hash tokens')
            const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
            try {
              window.history.replaceState({}, '', window.location.pathname + window.location.search)
            } catch {}
            if (setErr) {
              setStatus('error')
              setMessage(setErr.message)
              router.replace(`/sign-in?error=auth_set_session_failed&message=${encodeURIComponent('Failed to set session from callback. Please try again.')}`)
              return
            }
          }
        } else if (recoveryToken && (recoveryType === 'recovery' || queryType === 'recovery')) {
          console.debug('[AuthCallback] verifyOtp recovery token, len:', String(recoveryToken?.length || 0))
          const { error } = await supabase.auth.verifyOtp({ token_hash: recoveryToken, type: 'recovery' })
          if (error) {
            setStatus('error')
            setMessage(error.message)
            router.replace(`/sign-in?error=auth_recovery_verify_failed&message=${encodeURIComponent('Failed to verify recovery token. Please try again.')}`)
            return
          }
        } else if (code) {
          console.debug('[AuthCallback] exchangeCodeForSession, codeLen:', String(code?.length || 0))
          const observedVerifier = hasCodeVerifierCookie()
          if (observedVerifier === false) {
            console.debug('[AuthCallback] code verifier cookie missing before exchange attempt')
          }
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.debug('[AuthCallback] exchangeCodeForSession failed:', error?.message)
            const flowType = queryType || ''
            const fallbackType = toEmailOtpType(flowType)
            const fallbackToken = recoveryToken || searchParams.get('token') || code || ''
            if (flowType === 'recovery') {
              const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash: code, type: 'recovery' })
              if (verifyErr) {
                setStatus('error')
                setMessage(verifyErr.message)
                router.replace(`/sign-in?error=auth_code_exchange_failed&message=${encodeURIComponent('Failed to verify authentication code. Please try again.')}`)
                return
              }
            } else if (fallbackType && fallbackToken) {
              console.debug('[AuthCallback] attempting verifyOtp fallback', fallbackType)
              const { error: otpErr } = await supabase.auth.verifyOtp({
                token_hash: fallbackToken,
                type: fallbackType,
              })
              if (otpErr) {
                console.debug('[AuthCallback] verifyOtp fallback failed:', otpErr.message)
                setStatus('error')
                setMessage(otpErr.message)
                router.replace(
                  `/sign-in?error=auth_code_exchange_failed&message=${encodeURIComponent(
                    'Failed to verify authentication code. Please request a fresh link.'
                  )}`
                )
                return
              }
            } else if (isPkceVerifierError(error.message)) {
              setStatus('error')
              setMessage(PKCE_HELP_MESSAGE)
              router.replace(
                `/sign-in?error=auth_link_expired&message=${encodeURIComponent(PKCE_HELP_MESSAGE)}`
              )
              return
            } else {
              setStatus('error')
              setMessage(error.message)
              router.replace(`/sign-in?error=auth_code_exchange_failed&message=${encodeURIComponent('Failed to verify authentication code. Please try again.')}`)
              return
            }
          }
        }

        const hashType = hashParams?.get('type') || ''
        const flowType = queryType || hashType
        const safeRedirect = redirectTo && redirectTo.startsWith('/') ? redirectTo : ''
        const target = safeRedirect || (flowType === 'recovery' || from === 'admin' ? '/reset-password' : '/')
        console.debug('[AuthCallback] redirect →', target)
        setStatus('done')
        router.replace(target)
      } catch (err: any) {
        setStatus('error')
        setMessage(err?.message || 'Unexpected error')
        router.replace(`/sign-in?error=auth_callback_error&message=${encodeURIComponent('Authentication failed. Please try again.')}`)
      }
    }

    finalize()
    return () => { cancelled = true }
  }, [router, searchParams])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center text-sm text-muted-foreground">
        {status === 'processing' && 'Completing authentication...'}
        {status === 'done' && 'Redirecting...'}
        {status === 'error' && `Authentication error${message ? `: ${message}` : ''}`}
      </div>
    </div>
  )
}




