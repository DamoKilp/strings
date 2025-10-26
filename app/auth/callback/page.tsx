import { Suspense } from 'react'
import CallbackClient from '@/app/auth/callback/CallbackClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center p-6 text-sm text-muted-foreground">Preparing authentication...</div>}>
      <CallbackClient />
    </Suspense>
  )
}


