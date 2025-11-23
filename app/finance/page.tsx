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

export const revalidate = 0

interface FinancePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  // Server-side authentication check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/sign-in?redirect_to=/finance')
  }

  // Resolve searchParams for Next.js 15 compatibility
  const params = await searchParams
  
  // Load initial data in parallel for better performance
  const currentMonthYear = getCurrentMonthYear()
  const [accountsResult, billsResult, projectionsResult, snapshotsResult] = await Promise.all([
    getAccounts(),
    getBills(),
    getProjections(currentMonthYear),
    getMonthlySnapshots(),
  ])

  // Extract data or use empty arrays as defaults
  const initialAccounts: FinanceAccount[] = accountsResult.data || []
  const initialBills: FinanceBill[] = billsResult.data || []
  const initialProjections: FinanceProjection[] = projectionsResult.data || []
  const initialSnapshots: MonthlySnapshot[] = snapshotsResult.data || []

  // Calculate initial bill payments paid from current month snapshot
  const initialBillPaymentsPaid: Record<string, number> = {}
  const currentSnapshot = initialSnapshots.find(s => s.month_year === currentMonthYear)
  if (currentSnapshot) {
    // Load payments paid from snapshot (support both old and new format)
    for (const [billId, status] of Object.entries(currentSnapshot.bill_statuses)) {
      if (typeof status === 'object' && status !== null) {
        // New format with payments_paid
        if ('payments_paid' in status && typeof status.payments_paid === 'number') {
          initialBillPaymentsPaid[billId] = status.payments_paid
        } else if ('paid' in status && status.paid === true) {
          // Old format - mark as 999 to indicate fully paid (will be normalized later)
          initialBillPaymentsPaid[billId] = 999
        }
      }
    }
  }

  // Process projections to ensure entry_time and deduplicate
  const processedProjections: FinanceProjection[] = initialProjections
    .map(p => ({
      ...p,
      entry_time: p.entry_time || '00:00:00', // Default to midnight if missing
    }))
    // Deduplicate projections by unique constraint (user_id, projection_date, days_remaining, entry_time)
    .reduce((acc, current) => {
      const key = `${current.projection_date}-${current.days_remaining}-${current.entry_time}`
      const existing = acc.find(p => `${p.projection_date}-${p.days_remaining}-${p.entry_time}` === key)
      if (existing) {
        // Keep the one with the most recent updated_at or id (more recent ID)
        const existingDate = new Date(existing.updated_at || existing.created_at)
        const currentDate = new Date(current.updated_at || current.created_at)
        if (currentDate > existingDate || (currentDate.getTime() === existingDate.getTime() && current.id > existing.id)) {
          const index = acc.indexOf(existing)
          acc[index] = current
        }
      } else {
        acc.push(current)
      }
      return acc
    }, [] as FinanceProjection[])
    // Sort by date descending, then days remaining ascending, then time descending
    .sort((a, b) => {
      const dateDiff = new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
      if (dateDiff !== 0) return dateDiff
      if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining
      // Sort by time descending (most recent first)
      const timeA = a.entry_time || '00:00:00'
      const timeB = b.entry_time || '00:00:00'
      return timeB.localeCompare(timeA)
    })

  // Pass all initial data to client component
  return (
    <FinancePageClient
      initialAccounts={initialAccounts}
      initialBills={initialBills}
      initialProjections={processedProjections}
      initialSnapshots={initialSnapshots}
      initialBillPaymentsPaid={initialBillPaymentsPaid}
    />
  )
}
