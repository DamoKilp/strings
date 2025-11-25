import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  getAccounts,
  getBills,
  getProjections,
  getMonthlySnapshots,
  type FinanceAccount,
  type FinanceBill,
  type FinanceProjection,
  type MonthlySnapshot,
} from '@/app/actions/finance'
import FinancePageClient from './FinancePageClient'
import { getCurrentMonthYear } from '@/lib/financeUtils'

// 🚀 CRITICAL FIX: Make page fully static to prevent ANY server re-runs on focus
// By making this static and moving all data fetching to client-side, Next.js will never
// re-run this component when the window regains focus. Auth is handled by middleware.
export const dynamic = 'force-static'
export const revalidate = false

// 🔍 CRITICAL: Use stable constants outside component to prevent prop changes
// Even if server component re-runs (HMR in dev), these references stay the same
const EMPTY_ACCOUNTS: FinanceAccount[] = []
const EMPTY_BILLS: FinanceBill[] = []
const EMPTY_PROJECTIONS: FinanceProjection[] = []
const EMPTY_SNAPSHOTS: MonthlySnapshot[] = []
const EMPTY_PAYMENTS: Record<string, number> = Object.freeze({})

interface FinancePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  // Resolve searchParams for Next.js 15 compatibility (but we don't use them)
  await searchParams
  
  // 🚀 STATIC PAGE: Use stable constants - client component will fetch everything
  // Using constants outside component ensures React sees same prop references
  // even if server component re-runs (prevents prop change detection)
  return (
    <FinancePageClient
      initialAccounts={EMPTY_ACCOUNTS}
      initialBills={EMPTY_BILLS}
      initialProjections={EMPTY_PROJECTIONS}
      initialSnapshots={EMPTY_SNAPSHOTS}
      initialBillPaymentsPaid={EMPTY_PAYMENTS}
    />
  )
}
