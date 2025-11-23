'use client'

import React, { useEffect, useMemo, useState, useCallback, useTransition, useRef, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContentGlass,
  DialogHeaderGlass,
  DialogFooterGlass,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  getAccounts,
  getBills,
  updateAccountBalance,
  upsertAccount,
  upsertBill,
  deleteBill,
  saveMonthlySnapshot,
  getMonthlySnapshots,
  loadMonthlySnapshot,
  getProjections,
  getAllProjections,
  upsertProjection,
  deleteProjection,
  getBillingPeriods,
  getBillingPeriod,
  createBillingPeriod,
  type FinanceAccount,
  type FinanceBill,
  type MonthlySnapshot,
  type FinanceProjection,
  type BillingPeriod,
} from '@/app/actions/finance'
import {
  calculateBillsBreakdown,
  calculateTotalBillsRemaining,
  calculateCashFlowProjection,
  getCurrentMonthYear,
  formatCurrency,
  formatNextDueDate,
  type BillWithRemaining,
} from '@/lib/financeUtils'
import { useAuth } from '@/app/hooks/useAuth'
import { toast } from 'sonner'
import { TabsGlass, TabsListGlass, TabsTriggerGlass, TabsContentGlass } from '@/components/ui/tabs-glass'
import HistoricalSpendTrackingTab from './HistoricalSpendTrackingTab'
import ChartAnalysisTab from './ChartAnalysisTab'
import BillingPeriodManagerTab from './BillingPeriodManagerTab'

// Debounce utility for balance updates
function useDebounce<T extends (...args: unknown[]) => void>(callback: T, delay: number): T {
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)
  
  return React.useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay]) as T
}

interface FinancePageClientProps {
  initialAccounts: FinanceAccount[]
  initialBills: FinanceBill[]
  initialProjections: FinanceProjection[]
  initialSnapshots: MonthlySnapshot[]
  initialBillPaymentsPaid: Record<string, number>
}

export default function FinancePageClient({
  initialAccounts,
  initialBills,
  initialProjections,
  initialSnapshots,
  initialBillPaymentsPaid,
}: FinancePageClientProps) {
  const { user, isLoading: isAuthLoading } = useAuth()
  

  

  
  const [accounts, setAccounts] = useState<FinanceAccount[]>(initialAccounts)
  const [bills, setBills] = useState<FinanceBill[]>(initialBills)
  const [billPaymentsPaid, setBillPaymentsPaid] = useState<Record<string, number>>(initialBillPaymentsPaid)
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear())
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>(initialSnapshots)
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([])
  const [selectedBillingPeriodId, setSelectedBillingPeriodId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  
  // Dialog states
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false)
  const [isAddBillDialogOpen, setIsAddBillDialogOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingNextPeriod, setIsCreatingNextPeriod] = useState(false)
  const [isCreateNextPeriodDialogOpen, setIsCreateNextPeriodDialogOpen] = useState(false)
  
  // Create next period form state
  const [nextPeriodForm, setNextPeriodForm] = useState({
    title: '',
    start_date: '',
    end_date: '',
    reset_bills: true,
  })
  const [activeTab, setActiveTab] = useState('current')
  const [allHistoricalProjections, setAllHistoricalProjections] = useState<FinanceProjection[]>([])
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false)
  
  // Bills Breakdown table sorting state with localStorage persistence
  const [billsSortColumn, setBillsSortColumn] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('billsSortColumn')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Invalid JSON, use default
        }
      }
    }
    return null
  })
  const [billsSortDirection, setBillsSortDirection] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('billsSortDirection')
      if (saved === 'asc' || saved === 'desc') {
        return saved
      }
    }
    return 'asc'
  })
  
  // Save sort state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (billsSortColumn !== null) {
        localStorage.setItem('billsSortColumn', JSON.stringify(billsSortColumn))
      } else {
        localStorage.removeItem('billsSortColumn')
      }
    }
  }, [billsSortColumn])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('billsSortDirection', billsSortDirection)
    }
  }, [billsSortDirection])
  
  // Spend Tracking table column order state with localStorage persistence
  const [spendTrackingColumnOrder, setSpendTrackingColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('spendTrackingColumnOrder')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Invalid JSON, use default
        }
      }
    }
    // Default order
    return [
      'time',
      'daysRemaining',
      ...accounts.map(a => `account_${a.id}`),
      'total',
      'billsRemaining',
      'cashAvailable',
      'cashPerWeek',
      'leftOver450',
      'minAmountNeeded',
      'spendingPerDay',
      'notes',
      'delete'
    ]
  })
  
  // Update column order when accounts change (add new account columns)
  const accountIdsStr = useMemo(() => accounts.map(a => a.id).sort().join(','), [accounts])
  useEffect(() => {
    if (accounts.length === 0) return
    
    const accountColumnIds = accounts.map(a => `account_${a.id}`)
    const currentAccountColumns = spendTrackingColumnOrder.filter(id => id.startsWith('account_'))
    
    // Check if account columns need updating
    const missingAccounts = accountColumnIds.filter(id => !spendTrackingColumnOrder.includes(id))
    const extraAccounts = currentAccountColumns.filter(id => !accountColumnIds.includes(id))
    
    if (missingAccounts.length > 0 || extraAccounts.length > 0) {
      // Remove old account columns and add new ones
      const nonAccountColumns = spendTrackingColumnOrder.filter(id => !id.startsWith('account_'))
      const accountIndex = nonAccountColumns.indexOf('total') // Insert accounts before 'total'
      const newOrder = [
        ...nonAccountColumns.slice(0, accountIndex),
        ...accountColumnIds,
        ...nonAccountColumns.slice(accountIndex)
      ]
      setSpendTrackingColumnOrder(newOrder)
      if (typeof window !== 'undefined') {
        localStorage.setItem('spendTrackingColumnOrder', JSON.stringify(newOrder))
      }
    }
    // Only depend on accountIdsStr, not spendTrackingColumnOrder to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsStr])
  
  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && spendTrackingColumnOrder.length > 0) {
      localStorage.setItem('spendTrackingColumnOrder', JSON.stringify(spendTrackingColumnOrder))
    }
  }, [spendTrackingColumnOrder])
  
  // Handle column reordering via drag and drop
  const handleColumnDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnId)
    ;(e.target as HTMLElement).style.opacity = '0.5'
  }, [])
  
  const handleColumnDragEnd = useCallback((e: React.DragEvent) => {
    ;(e.target as HTMLElement).style.opacity = '1'
  }, [])
  
  const handleColumnDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])
  
  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    const draggedColumnId = e.dataTransfer.getData('text/plain')
    
    if (draggedColumnId === targetColumnId) return
    
    setSpendTrackingColumnOrder(prev => {
      const newOrder = [...prev]
      const draggedIndex = newOrder.indexOf(draggedColumnId)
      const targetIndex = newOrder.indexOf(targetColumnId)
      
      if (draggedIndex === -1 || targetIndex === -1) return prev
      
      // Remove dragged column and insert at target position
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedColumnId)
      
      return newOrder
    })
  }, [])

  // Load all historical projections when switching to historical or charts tabs
  useEffect(() => {
    if ((activeTab === 'historical' || activeTab === 'charts') && allHistoricalProjections.length === 0 && !isLoadingHistorical) {
      setIsLoadingHistorical(true)
      getAllProjections().then(result => {
        if (result.data) {
          setAllHistoricalProjections(result.data)
        }
        setIsLoadingHistorical(false)
      }).catch(() => {
        setIsLoadingHistorical(false)
      })
    }
  }, [activeTab, allHistoricalProjections.length, isLoadingHistorical])

  // Pay cycle dates (based on pay dates)
  const today = useMemo(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }, [])

  // Initialize pay cycle dates
  const getDefaultPayCycle = (): { start: string; end: string } => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    
    // Default: start on 14th of current month
    const startDate = new Date(currentYear, currentMonth, 14)
    if (startDate > now) {
      // If 14th hasn't passed, use 14th of previous month
      startDate.setMonth(currentMonth - 1)
    }
    
    // End date: next month's 12th (typical pay cycle)
    const endDate = new Date(currentYear, currentMonth + 1, 12)
    if (endDate <= now) {
      endDate.setMonth(currentMonth + 2)
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }

  // Load pay cycle from localStorage or use defaults
  const [payCycleStart, setPayCycleStart] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finance_pay_cycle_start')
      if (saved) return saved
    }
    return getDefaultPayCycle().start
  })

  const [payCycleEnd, setPayCycleEnd] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finance_pay_cycle_end')
      if (saved) return saved
    }
    return getDefaultPayCycle().end
  })

  // Persist pay cycle dates to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finance_pay_cycle_start', payCycleStart)
      localStorage.setItem('finance_pay_cycle_end', payCycleEnd)
    }
  }, [payCycleStart, payCycleEnd])

  // CRITICAL: Ensure pay cycle dates stay in sync with selected billing period
  // If a billing period is selected, its dates should always match the period's dates
  // This effect runs when the selected period changes and ensures dates match
  useEffect(() => {
    if (selectedBillingPeriodId && billingPeriods.length > 0) {
      const period = billingPeriods.find(p => p.id === selectedBillingPeriodId)
      if (period) {
        // Always sync dates to match the period when period selection changes
        // This ensures dates are correct even if something else tries to override them
        const periodStartFormatted = period.start_date.split('T')[0]
        const periodEndFormatted = period.end_date.split('T')[0]
        setPayCycleStart(periodStartFormatted)
        setPayCycleEnd(periodEndFormatted)
      }
    }
  }, [selectedBillingPeriodId, billingPeriods, payCycleStart, payCycleEnd]) // Only sync when period selection changes

  // Optimistically update account balance immediately
  const optimisticallyUpdateBalance = useCallback((accountId: string, newBalance: number) => {
    setAccounts(prev => prev.map(acc => 
      acc.id === accountId ? { ...acc, balance: newBalance } : acc
    ))
  }, [])

  // Debounced balance update function
  const debouncedUpdateBalance = useDebounce(async (accountId: string, newBalance: number) => {
    const res = await updateAccountBalance(accountId, newBalance)
    if (res.error) {
      // Revert on error - reload accounts to get correct state
      const accountsRes = await getAccounts()
      if (accountsRes.data) setAccounts(accountsRes.data)
    }
  }, 500)

  // Load data - optimized to select only needed fields
  const loadData = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [accountsRes, billsRes, snapshotsRes, projectionsRes, periodsRes] = await Promise.all([
        getAccounts(),
        getBills(),
        getMonthlySnapshots(),
        getProjections(selectedMonthYear),
        getBillingPeriods(),
      ])

      if (accountsRes.data) setAccounts(accountsRes.data)
      if (billsRes.data) setBills(billsRes.data)
      if (periodsRes.data) setBillingPeriods(periodsRes.data)
      if (snapshotsRes.data) {
        setMonthlySnapshots(snapshotsRes.data)
        const currentMonth = getCurrentMonthYear()
        const currentSnapshot = snapshotsRes.data.find(s => s.month_year === currentMonth)
        if (currentSnapshot) {
          // Load payments paid from snapshot (support both old and new format)
          const paymentsPaid: Record<string, number> = {}
          for (const [billId, status] of Object.entries(currentSnapshot.bill_statuses)) {
            if (typeof status === 'object' && status !== null) {
              // New format with payments_paid
              if ('payments_paid' in status && typeof status.payments_paid === 'number') {
                paymentsPaid[billId] = status.payments_paid
              } else if ('paid' in status && status.paid === true) {
                // Old format - we'll normalize this after calculating breakdown
                // For now, mark as a high number to indicate fully paid
                paymentsPaid[billId] = 999 // Will be normalized to actual totalPayments
              }
            }
          }
          setBillPaymentsPaid(paymentsPaid)
        }
      }
      if (projectionsRes.data) {
        // Ensure all projections have an entry_time (backward compatibility)
        const projectionsWithTime = projectionsRes.data.map(p => ({
          ...p,
          entry_time: p.entry_time || '00:00:00' // Default to midnight if missing
        }))
        
        // Deduplicate projections by unique constraint (user_id, projection_date, days_remaining, entry_time)
        // Keep the most recently updated one if duplicates exist
        const deduplicated = projectionsWithTime.reduce((acc, current) => {
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
        const sorted = deduplicated.sort((a, b) => {
          const dateDiff = new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
          if (dateDiff !== 0) return dateDiff
          if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining
          // Sort by time descending (most recent first)
          const timeA = a.entry_time || '00:00:00'
          const timeB = b.entry_time || '00:00:00'
          return timeB.localeCompare(timeA)
        })
        setProjections(sorted)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user, selectedMonthYear])

  // Sync with server-side initial data
  // Use JSON.stringify for array/object comparison to avoid infinite loops
  // Track if we've made client-side modifications to prevent overwriting with stale server data
  const hasClientModifications = useRef(false)
  // Track if we've already initialized from props to prevent resetting state on revalidation
  const hasInitialized = useRef(false)
  
  // 🚀 FIXED: Only initialize state from props on initial mount, not on prop changes from revalidation
  // This prevents the page from resetting when Next.js revalidates on focus change
  useEffect(() => {
    // Only initialize once on mount
    if (hasInitialized.current) {
      return
    }
    
    setAccounts(initialAccounts)
    setBills(initialBills)
    // Only update projections from server if we haven't made client-side modifications
    // This prevents overwriting client-side updates with stale server data after revalidation
    // The projections state is managed by the add/update/delete handlers
    if (!hasClientModifications.current || projections.length === 0) {
      setProjections(initialProjections)
      hasClientModifications.current = false
    }
    setMonthlySnapshots(initialSnapshots)
    setBillPaymentsPaid(initialBillPaymentsPaid)
    
    hasInitialized.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Calculate pay cycle days
  const payCycleDays = useMemo(() => {
    const start = new Date(payCycleStart)
    const end = new Date(payCycleEnd)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const result = Math.max(0, diffDays)
    return result
  }, [payCycleStart, payCycleEnd])

  // Calculate days remaining in pay cycle
  const daysRemainingInCycle = useMemo(() => {
    const todayDate = new Date(today)
    const endDate = new Date(payCycleEnd)
    const diffTime = endDate.getTime() - todayDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const result = Math.max(0, diffDays)
    return result
  }, [today, payCycleEnd])

  // Use pay cycle days remaining for projections instead of month days
  const daysRemaining = daysRemainingInCycle

  // Calculate bills breakdown with stable dependencies - using pay cycle dates
  const billsBreakdown = useMemo<BillWithRemaining[]>(() => {
    if (!bills.length) {
      return []
    }
    const result = calculateBillsBreakdown(bills, billPaymentsPaid, payCycleStart, payCycleEnd, daysRemaining)
    return result
  }, [bills, billPaymentsPaid, payCycleStart, payCycleEnd, daysRemaining])

  // Sorted bills breakdown for table display
  const sortedBillsBreakdown = useMemo<BillWithRemaining[]>(() => {
    if (!billsSortColumn) return billsBreakdown
    
    const sorted = [...billsBreakdown].sort((a, b) => {
      let aValue: string | number | null | undefined
      let bValue: string | number | null | undefined
      
      switch (billsSortColumn) {
        case 'paymentDate':
          aValue = a.bill.next_due_date
          bValue = b.bill.next_due_date
          break
        case 'company':
          aValue = a.bill.company_name.toLowerCase()
          bValue = b.bill.company_name.toLowerCase()
          break
        case 'amountCharged':
          aValue = a.bill.amount
          bValue = b.bill.amount
          break
        case 'typicalAmount':
          aValue = a.bill.typical_amount ?? 0
          bValue = b.bill.typical_amount ?? 0
          break
        case 'chargeCycle':
          aValue = a.bill.charge_cycle
          bValue = b.bill.charge_cycle
          break
        case 'multiplier':
          aValue = a.bill.multiplier_type ?? ''
          bValue = b.bill.multiplier_type ?? ''
          break
        case 'paymentDay':
          aValue = a.bill.payment_day ?? 0
          bValue = b.bill.payment_day ?? 0
          break
        case 'weeksRemaining':
          aValue = a.weeksRemaining ?? 0
          bValue = b.weeksRemaining ?? 0
          break
        case 'totalWeeklyCost':
          aValue = a.totalWeeklyCost
          bValue = b.totalWeeklyCost
          break
        case 'totalMonthlyCost':
          aValue = a.totalMonthlyCost
          bValue = b.totalMonthlyCost
          break
        case 'remainingThisMonth':
          aValue = a.remainingThisMonth
          bValue = b.remainingThisMonth
          break
        case 'billingAccount':
          aValue = a.bill.billing_account_id ?? ''
          bValue = b.bill.billing_account_id ?? ''
          break
        case 'paid':
          aValue = a.paymentsPaid
          bValue = b.paymentsPaid
          break
        default:
          return 0
      }
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1
      
      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // For dates, convert to timestamps for proper sorting
        if (billsSortColumn === 'paymentDate') {
          const aDate = new Date(aValue).getTime()
          const bDate = new Date(bValue).getTime()
          return billsSortDirection === 'asc' ? aDate - bDate : bDate - aDate
        }
        return billsSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      // Numeric comparison
      const numA = typeof aValue === 'number' ? aValue : parseFloat(String(aValue))
      const numB = typeof bValue === 'number' ? bValue : parseFloat(String(bValue))
      return billsSortDirection === 'asc' ? numA - numB : numB - numA
    })
    
    return sorted
  }, [billsBreakdown, billsSortColumn, billsSortDirection])

  
  // Calculate column totals for Bills Breakdown table footer
  const billsBreakdownTotals = useMemo(() => {
    return {
      totalWeeklyCost: billsBreakdown.reduce((sum, item) => sum + item.totalWeeklyCost, 0),
      totalMonthlyCost: billsBreakdown.reduce((sum, item) => sum + item.totalMonthlyCost, 0),
      remainingThisMonth: billsBreakdown.reduce((sum, item) => sum + item.remainingThisMonth, 0),
    }
  }, [billsBreakdown])

  const billsRemaining = useMemo(() => {
    return calculateTotalBillsRemaining(
      bills.map(b => ({
        id: b.id,
        amount: b.amount,
        charge_cycle: b.charge_cycle,
        next_due_date: b.next_due_date,
        multiplier_type: b.multiplier_type,
        payment_day: b.payment_day,
      })),
      billPaymentsPaid,
      payCycleStart,
      payCycleEnd
    )
  }, [bills, billPaymentsPaid, payCycleStart, payCycleEnd])

  // Memoize account balances map
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    for (const account of accounts) {
      balances[account.id] = account.balance
    }
    return balances
  }, [accounts])

  // Memoize accounts map for fast lookups
  const accountsMap = useMemo(() => {
    const map = new Map<string, FinanceAccount>()
    for (const account of accounts) {
      map.set(account.id, account)
    }
    return map
  }, [accounts])

  // Handle double-click on Bills Breakdown table column headers for sorting
  const handleBillsColumnSort = useCallback((column: string) => {
    if (billsSortColumn === column) {
      // Toggle direction if same column
      setBillsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setBillsSortColumn(column)
      setBillsSortDirection('asc')
    }
  }, [billsSortColumn])

  // Calculate account requirements (sum of remaining this month per account)
  const accountRequirements = useMemo(() => {
    const requirements: Record<string, number> = {}
    
    // Initialize all accounts with 0
    for (const account of accounts) {
      requirements[account.id] = 0
    }
    
    // Sum remaining amounts per account
    for (const item of billsBreakdown) {
      const bill = item.bill
      // Only count bills with remaining amount
      if (item.remainingThisMonth > 0 && bill.billing_account_id) {
        const accountId = bill.billing_account_id
        if (requirements.hasOwnProperty(accountId)) {
          requirements[accountId] += item.remainingThisMonth
        }
      }
    }
    
    return requirements
  }, [billsBreakdown, accounts])

  // Memoize projection (only recalculate when dependencies change)
  // Find the best matching projection from spend tracking based on current date and days remaining
  const projection = useMemo(() => {
    if (!projections.length) {
      // Fallback to calculated projection if no spend tracking data exists
      return calculateCashFlowProjection(
        accountBalances,
        billsRemaining,
        daysRemaining
      )
    }

    // Determine the reference date for matching
    // Use today if it's within the current period, otherwise use period start
    const todayDate = new Date(today)
    todayDate.setHours(0, 0, 0, 0)
    const periodStartDate = new Date(payCycleStart)
    periodStartDate.setHours(0, 0, 0, 0)
    const periodEndDate = new Date(payCycleEnd)
    periodEndDate.setHours(0, 0, 0, 0)
    
    // Use today if within period, otherwise use period start
    const referenceDate = (todayDate >= periodStartDate && todayDate <= periodEndDate) 
      ? todayDate 
      : periodStartDate
    
    // First, try to find exact match on both date and days_remaining
    let bestMatch = projections.find(p => {
      const projDate = new Date(p.projection_date)
      projDate.setHours(0, 0, 0, 0)
      return projDate.getTime() === referenceDate.getTime() && p.days_remaining === daysRemaining
    })
    
    if (bestMatch) {
      return {
        daysRemaining: bestMatch.days_remaining,
        accountBalances: bestMatch.account_balances,
        billsAmount: bestMatch.bills_amount,
        totalAvailable: bestMatch.total_available,
        billsRemaining: bestMatch.bills_remaining,
        cashAvailable: bestMatch.cash_available,
        cashPerWeek: bestMatch.cash_per_week,
        spendingPerDay: bestMatch.spending_per_day,
      }
    }
    
    // Second, try to find match on date with closest days_remaining
    const sameDateProjections = projections.filter(p => {
      const projDate = new Date(p.projection_date)
      projDate.setHours(0, 0, 0, 0)
      return projDate.getTime() === referenceDate.getTime()
    })
    
    if (sameDateProjections.length > 0) {
      bestMatch = sameDateProjections.reduce((closest, current) => {
        const closestDiff = Math.abs(closest.days_remaining - daysRemaining)
        const currentDiff = Math.abs(current.days_remaining - daysRemaining)
        return currentDiff < closestDiff ? current : closest
      })
      
      return {
        daysRemaining: bestMatch.days_remaining,
        accountBalances: bestMatch.account_balances,
        billsAmount: bestMatch.bills_amount,
        totalAvailable: bestMatch.total_available,
        billsRemaining: bestMatch.bills_remaining,
        cashAvailable: bestMatch.cash_available,
        cashPerWeek: bestMatch.cash_per_week,
        spendingPerDay: bestMatch.spending_per_day,
      }
    }
    
    // Third, try to find match on days_remaining with closest date
    const sameDaysProjections = projections.filter(p => p.days_remaining === daysRemaining)
    
    if (sameDaysProjections.length > 0) {
      bestMatch = sameDaysProjections.reduce((closest, current) => {
        const closestDate = new Date(closest.projection_date)
        closestDate.setHours(0, 0, 0, 0)
        const currentDate = new Date(current.projection_date)
        currentDate.setHours(0, 0, 0, 0)
        const closestDiff = Math.abs(closestDate.getTime() - referenceDate.getTime())
        const currentDiff = Math.abs(currentDate.getTime() - referenceDate.getTime())
        return currentDiff < closestDiff ? current : closest
      })
      
      return {
        daysRemaining: bestMatch.days_remaining,
        accountBalances: bestMatch.account_balances,
        billsAmount: bestMatch.bills_amount,
        totalAvailable: bestMatch.total_available,
        billsRemaining: bestMatch.bills_remaining,
        cashAvailable: bestMatch.cash_available,
        cashPerWeek: bestMatch.cash_per_week,
        spendingPerDay: bestMatch.spending_per_day,
      }
    }
    
    // Fourth, find closest match on both date and days_remaining
    bestMatch = projections.reduce((closest, current) => {
      const closestDate = new Date(closest.projection_date)
      closestDate.setHours(0, 0, 0, 0)
      const currentDate = new Date(current.projection_date)
      currentDate.setHours(0, 0, 0, 0)
      
      const closestDateDiff = Math.abs(closestDate.getTime() - referenceDate.getTime())
      const currentDateDiff = Math.abs(currentDate.getTime() - referenceDate.getTime())
      const closestDaysDiff = Math.abs(closest.days_remaining - daysRemaining)
      const currentDaysDiff = Math.abs(current.days_remaining - daysRemaining)
      
      // Weight date difference more heavily (days in milliseconds)
      const closestScore = closestDateDiff + (closestDaysDiff * 86400000)
      const currentScore = currentDateDiff + (currentDaysDiff * 86400000)
      
      return currentScore < closestScore ? current : closest
    })
    
    return {
      daysRemaining: bestMatch.days_remaining,
      accountBalances: bestMatch.account_balances,
      billsAmount: bestMatch.bills_amount,
      totalAvailable: bestMatch.total_available,
      billsRemaining: bestMatch.bills_remaining,
      cashAvailable: bestMatch.cash_available,
      cashPerWeek: bestMatch.cash_per_week,
      spendingPerDay: bestMatch.spending_per_day,
    }
  }, [projections, today, daysRemaining, payCycleStart, payCycleEnd, accountBalances, billsRemaining])

  // Auto-save bill payment statuses to snapshot (debounced)
  // IMPORTANT: Saves to the currently selected billing period's snapshot, not current month
  const saveBillPaymentStatusesInDb = useCallback(async (currentBillPaymentsPaid: Record<string, number>) => {
    if (!user) return
    
    try {
      // Determine which snapshot to save to based on selected billing period or selected month
      let monthYear: string | null = null
      
      if (selectedBillingPeriodId) {
        // If a billing period is selected, use its snapshot's month_year
        const period = billingPeriods.find(p => p.id === selectedBillingPeriodId)
        if (period?.snapshot_id) {
          const snapshot = monthlySnapshots.find(s => s.id === period.snapshot_id)
          if (snapshot) {
            monthYear = snapshot.month_year
          }
        }
      } else if (selectedMonthYear) {
        // If a monthly snapshot is selected, use that month_year
        monthYear = selectedMonthYear
      }
      
      // Fallback to current month if nothing is selected (for backward compatibility)
      if (!monthYear) {
        monthYear = getCurrentMonthYear()
      }
      
      const billStatuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid: number }> = {}
      for (const bill of bills) {
        const paymentsPaid = currentBillPaymentsPaid[bill.id] || 0
        const isFullyPaid = paymentsPaid > 0 && paymentsPaid === billsBreakdown.find(b => b.bill.id === bill.id)?.totalPayments
        billStatuses[bill.id] = {
          paid: isFullyPaid, // Keep for backward compatibility
          paid_date: isFullyPaid ? new Date().toISOString().split('T')[0] : null,
          payments_paid: paymentsPaid,
        }
      }

      const res = await saveMonthlySnapshot({
        month_year: monthYear,
        account_balances: accountBalances,
        bill_statuses: billStatuses,
        cash_flow_data: projection as unknown as Record<string, unknown>,
      })

      if (res.error) {
        console.error('Failed to auto-save bill payment statuses:', res.error)
        // Silently fail for auto-save to avoid annoying the user
      } else {
        // Update snapshots state if save was successful
        const snapshotsRes = await getMonthlySnapshots()
        if (snapshotsRes.data) {
          setMonthlySnapshots(snapshotsRes.data)
        }
      }
    } catch (err) {
      console.error('Failed to auto-save bill payment statuses:', err)
    }
  }, [user, bills, billsBreakdown, accountBalances, projection, selectedBillingPeriodId, selectedMonthYear, billingPeriods, monthlySnapshots])

  // Debounced auto-save for bill payment statuses
  const debouncedSaveBillPaymentStatuses = useDebounce(saveBillPaymentStatusesInDb, 1000)

  // Update payments paid for a bill
  const handleUpdatePaymentsPaid = useCallback((billId: string, paymentsPaid: number, totalPayments: number) => {
    startTransition(() => {
      setBillPaymentsPaid(prev => {
        const newPayments = { ...prev }
        if (paymentsPaid === 0) {
          delete newPayments[billId]
        } else {
          // Clamp to valid range
          newPayments[billId] = Math.max(0, Math.min(paymentsPaid, totalPayments))
        }
        // Auto-save to DB with debounce
        debouncedSaveBillPaymentStatuses(newPayments)
        return newPayments
      })
    })
  }, [debouncedSaveBillPaymentStatuses])

  // Update bill handler with debounce
  const updateBillInDb = useCallback(async (billId: string, updates: Partial<FinanceBill>) => {
    const bill = bills.find(b => b.id === billId)
    if (!bill) return

    const res = await upsertBill({ ...bill, ...updates })
    if (res.error) {
      toast.error('Failed to update bill', { description: res.error })
      // Reload bills on error
      const billsRes = await getBills()
      if (billsRes.data) setBills(billsRes.data)
    }
  }, [bills])

  // Debounced bill update
  const debouncedUpdateBill = useDebounce(updateBillInDb, 500)

  // Handle update bill
  const handleUpdateBill = useCallback((billId: string, updates: Partial<FinanceBill>) => {
    // Optimistic update
    setBills(prev => prev.map(b => b.id === billId ? { ...b, ...updates } : b))
    
    // Save to DB with debounce
    debouncedUpdateBill(billId, updates)
  }, [debouncedUpdateBill])


  // Handle add account
  const handleAddAccount = useCallback(async (name: string, accountType: FinanceAccount['account_type'], balance: number) => {
    if (!user) return
    
    const res = await upsertAccount({
      name,
      account_type: accountType,
      balance,
    })
    
    if (res.error) {
      toast.error('Failed to add account', { description: res.error })
    } else if (res.data) {
      setAccounts(prev => [...prev, res.data!].sort((a, b) => a.sort_order - b.sort_order))
      setIsAddAccountDialogOpen(false)
      toast.success('Account added')
    }
  }, [user])

  // Handle add bill
  const handleAddBill = useCallback(async (billData: Partial<FinanceBill> & { company_name: string; amount: number; charge_cycle: FinanceBill['charge_cycle']; next_due_date: string }) => {
    if (!user) return
    
    const res = editingBill 
      ? await upsertBill({ ...editingBill, ...billData })
      : await upsertBill(billData)
    
    if (res.error) {
      toast.error('Failed to save bill', { description: res.error })
    } else if (res.data) {
      // Reload bills to get updated list
      const billsRes = await getBills()
      if (billsRes.data) {
        setBills(billsRes.data)
      }
      setIsAddBillDialogOpen(false)
      setEditingBill(null)
      toast.success(editingBill ? 'Bill updated' : 'Bill added')
    }
  }, [user, editingBill])

  // Handle delete bill
  const handleDeleteBill = useCallback(async (billId: string) => {
    if (!user) return
    
    const res = await deleteBill(billId)
    if (res.error) {
      toast.error('Failed to delete bill', { description: res.error })
    } else {
      setBills(prev => prev.filter(b => b.id !== billId))
      toast.success('Bill deleted')
    }
  }, [user])

  // Save monthly snapshot
  const handleSaveSnapshot = useCallback(async (): Promise<boolean> => {
    if (!user || isSaving) return false
    setIsSaving(true)
    try {
      const monthYear = getCurrentMonthYear()
      const billStatuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid: number }> = {}
      for (const bill of bills) {
        const paymentsPaid = billPaymentsPaid[bill.id] || 0
        const isFullyPaid = paymentsPaid > 0 && paymentsPaid === billsBreakdown.find(b => b.bill.id === bill.id)?.totalPayments
        billStatuses[bill.id] = {
          paid: isFullyPaid, // Keep for backward compatibility
          paid_date: isFullyPaid ? new Date().toISOString().split('T')[0] : null,
          payments_paid: paymentsPaid,
        }
      }

      const res = await saveMonthlySnapshot({
        month_year: monthYear,
        account_balances: accountBalances,
        bill_statuses: billStatuses,
        cash_flow_data: projection as unknown as Record<string, unknown>,
      })

      if (res.error) {
        toast.error('Failed to save snapshot', { description: res.error })
        return false
      }

      toast.success('Snapshot saved')
      // Reload snapshots
      const snapshotsRes = await getMonthlySnapshots()
      if (snapshotsRes.data) {
        setMonthlySnapshots(snapshotsRes.data)
      }
      return true
    } catch (err) {
      console.error('Failed to save snapshot:', err)
      toast.error('Failed to save snapshot')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [user, bills, billPaymentsPaid, billsBreakdown, accountBalances, projection, isSaving])

  // Create next billing period - saves current period and resets bills to unpaid
  // Open create next period dialog
  const handleCreateNextPeriod = useCallback(() => {
    // Set default dates: 15th of next month to 15th of the month after that
    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15)
    const monthAfterNext = new Date(today.getFullYear(), today.getMonth() + 2, 15)
    
    setNextPeriodForm({
      title: `Period ${nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      start_date: nextMonth.toISOString().split('T')[0],
      end_date: monthAfterNext.toISOString().split('T')[0],
      reset_bills: true,
    })
    setIsCreateNextPeriodDialogOpen(true)
  }, [])

  // Actually create the next period with form data
  const handleCreateNextPeriodSubmit = useCallback(async () => {
    if (!user || isCreatingNextPeriod) return
    
    if (!nextPeriodForm.title.trim()) {
      toast.error('Period title is required')
      return
    }
    if (!nextPeriodForm.start_date || !nextPeriodForm.end_date) {
      toast.error('Start date and end date are required')
      return
    }

    const startDate = new Date(nextPeriodForm.start_date)
    const endDate = new Date(nextPeriodForm.end_date)
    if (endDate < startDate) {
      toast.error('End date must be after start date')
      return
    }
    
    setIsCreatingNextPeriod(true)
    try {
      // First, save the current period as a snapshot
      const saved = await handleSaveSnapshot()
      if (!saved) {
        toast.error('Failed to save current period')
        return
      }

      // Wait a moment for the save to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Create a monthly snapshot for the NEW billing period with all bills unpaid
      // The month_year is based on the period start date
      const periodStartDate = new Date(nextPeriodForm.start_date)
      const newPeriodMonthYear = getCurrentMonthYear(periodStartDate)
      
      // Get current account balances
      const currentAccountBalances: Record<string, number> = {}
      accounts.forEach(account => {
        currentAccountBalances[account.id] = account.balance
      })

      // Create bill_statuses with all bills unpaid (payments_paid: 0)
      const newPeriodBillStatuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid: number }> = {}
      bills.forEach(bill => {
        newPeriodBillStatuses[bill.id] = {
          paid: false,
          paid_date: null,
          payments_paid: 0, // All bills start unpaid
        }
      })

      // Create the snapshot for the new period
      const newPeriodSnapshotRes = await saveMonthlySnapshot({
        month_year: newPeriodMonthYear,
        account_balances: currentAccountBalances,
        bill_statuses: newPeriodBillStatuses,
        cash_flow_data: null,
        notes: `Snapshot for billing period: ${nextPeriodForm.title.trim()}`,
      })

      if (newPeriodSnapshotRes.error) {
        toast.error(`Failed to create snapshot for new period: ${newPeriodSnapshotRes.error}`)
        return
      }

      // Create the billing period linked to the new snapshot
      const periodRes = await createBillingPeriod({
        period_name: nextPeriodForm.title.trim(),
        start_date: nextPeriodForm.start_date,
        end_date: nextPeriodForm.end_date,
        snapshot_id: newPeriodSnapshotRes.data?.id || null,
        notes: `Created with all bills unpaid`,
      })

      if (periodRes.error) {
        toast.error(`Failed to create period: ${periodRes.error}`)
        return
      }

      // Reset bills to unpaid for the new period
      startTransition(() => {
        setBillPaymentsPaid({}) // All bills unpaid
      })

      // Update pay cycle dates to match the new period
      setPayCycleStart(nextPeriodForm.start_date)
      setPayCycleEnd(nextPeriodForm.end_date)

      // Reload data to get the new period and snapshots
      await loadData()
      
      // Set the newly created period as selected
      if (periodRes.data) {
        setSelectedBillingPeriodId(periodRes.data.id)
      }

      // Load the snapshot we just created and restore bill statuses
      if (newPeriodSnapshotRes.data) {
        // Restore bill statuses from the new snapshot (all should be unpaid with payments_paid: 0)
        const paymentsPaid: Record<string, number> = {}
        for (const [billId, status] of Object.entries(newPeriodSnapshotRes.data.bill_statuses)) {
          if (typeof status === 'object' && status !== null) {
            if ('payments_paid' in status && typeof status.payments_paid === 'number') {
              paymentsPaid[billId] = status.payments_paid
            } else if ('paid' in status && status.paid === true) {
              paymentsPaid[billId] = 999
            }
          }
        }
        setBillPaymentsPaid(paymentsPaid)

        // Restore account balances from the snapshot
        for (const [accountId, balance] of Object.entries(newPeriodSnapshotRes.data.account_balances)) {
          const account = accounts.find(a => a.id === accountId)
          if (account) {
            optimisticallyUpdateBalance(accountId, balance)
            debouncedUpdateBalance(accountId, balance)
          }
        }
      }

      // Load projections for the new period's date range
      const allProjectionsRes = await getAllProjections()
      if (allProjectionsRes.data && periodRes.data) {
        const periodStart = new Date(periodRes.data.start_date)
        const periodEnd = new Date(periodRes.data.end_date)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setHours(23, 59, 59, 999)

        const filteredProjections = allProjectionsRes.data
          .filter(p => {
            const projDate = new Date(p.projection_date)
            projDate.setHours(0, 0, 0, 0)
            return projDate >= periodStart && projDate <= periodEnd
          })
          .map(p => ({
            ...p,
            entry_time: p.entry_time || '00:00:00'
          }))
          // Deduplicate
          .reduce((acc, current) => {
            const key = `${current.projection_date}-${current.days_remaining}-${current.entry_time}`
            const existing = acc.find(p => `${p.projection_date}-${p.days_remaining}-${p.entry_time}` === key)
            if (existing) {
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
            const timeA = a.entry_time || '00:00:00'
            const timeB = b.entry_time || '00:00:00'
            return timeB.localeCompare(timeA)
          })

        setProjections(filteredProjections)
      }

      // Select the newly created period
      if (periodRes.data) {
        setSelectedBillingPeriodId(periodRes.data.id)
      }

      setIsCreateNextPeriodDialogOpen(false)
      toast.success('Next billing period created', {
        description: nextPeriodForm.reset_bills 
          ? 'All bills reset to unpaid with full monthly costs'
          : 'Period created successfully'
      })
    } catch (err) {
      console.error('Failed to create next period:', err)
      toast.error('Failed to create next period')
    } finally {
      setIsCreatingNextPeriod(false)
    }
  }, [user, isCreatingNextPeriod, nextPeriodForm, handleSaveSnapshot, loadData, accounts, bills, optimisticallyUpdateBalance, debouncedUpdateBalance])

  // Load monthly snapshot
  const handleLoadSnapshot = useCallback(async (monthYear: string) => {
    if (!user) {
      return
    }
    
    const res = await loadMonthlySnapshot(monthYear)
    if (res.error || !res.data) {
      toast.error('Failed to load snapshot', { description: res.error || 'No snapshot found' })
      return
    }
    
    // Restore account balances
    for (const [accountId, balance] of Object.entries(res.data.account_balances)) {
      const account = accounts.find(a => a.id === accountId)
      if (account) {
        optimisticallyUpdateBalance(accountId, balance)
        debouncedUpdateBalance(accountId, balance)
      }
    }
    
    // Restore bill statuses (support both old and new format)
    const paymentsPaid: Record<string, number> = {}
    for (const [billId, status] of Object.entries(res.data.bill_statuses)) {
      if (typeof status === 'object' && status !== null) {
        if ('payments_paid' in status && typeof status.payments_paid === 'number') {
          paymentsPaid[billId] = status.payments_paid
        } else if ('paid' in status && status.paid === true) {
          paymentsPaid[billId] = 999 // Temporary marker for fully paid
        }
      }
    }
    
    // Use a function form of setState to ensure we're setting the latest value
    setBillPaymentsPaid(() => paymentsPaid)
    
    toast.success('Snapshot loaded', {
      description: `Restored ${monthYear} snapshot`
    })
  }, [user, accounts, optimisticallyUpdateBalance, debouncedUpdateBalance])

  // Load billing period (loads its associated snapshot and updates pay cycle dates)
  const handleLoadBillingPeriod = useCallback(async (periodId: string) => {
    if (!user) {
      return
    }

    setIsLoading(true)
    try {
      // CRITICAL: Fetch the period directly from the database to ensure we have the latest data
      // This prevents issues with stale state data that might have incorrect dates
      const periodRes = await getBillingPeriod(periodId)
      if (periodRes.error || !periodRes.data) {
        toast.error('Period not found', { description: periodRes.error || 'Failed to load period' })
        return
      }
      
      const period = periodRes.data

      // IMPORTANT: Save current state to current period's snapshot before switching
      // This ensures changes are persisted to the correct period
      if (selectedBillingPeriodId && selectedBillingPeriodId !== periodId) {
        const currentPeriod = billingPeriods.find(p => p.id === selectedBillingPeriodId)
        if (currentPeriod?.snapshot_id) {
          const currentSnapshot = monthlySnapshots.find(s => s.id === currentPeriod.snapshot_id)
          if (currentSnapshot) {
            // Save current bill payment statuses to current period's snapshot
            const billStatuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid: number }> = {}
            for (const bill of bills) {
              const paymentsPaid = billPaymentsPaid[bill.id] || 0
              const isFullyPaid = paymentsPaid > 0 && paymentsPaid === billsBreakdown.find(b => b.bill.id === bill.id)?.totalPayments
              billStatuses[bill.id] = {
                paid: isFullyPaid,
                paid_date: isFullyPaid ? new Date().toISOString().split('T')[0] : null,
                payments_paid: paymentsPaid,
              }
            }
            
            await saveMonthlySnapshot({
              month_year: currentSnapshot.month_year,
              account_balances: accountBalances,
              bill_statuses: billStatuses,
              cash_flow_data: projection as unknown as Record<string, unknown>,
            })
          }
        }
      }

      // Update pay cycle dates to match the period
      // CRITICAL: Set dates immediately and ensure they match the period's dates exactly
      // These dates come directly from the database and should be in YYYY-MM-DD format
      // Ensure dates are in the correct format (YYYY-MM-DD) for HTML date inputs
      const periodStartDate = period.start_date.split('T')[0] // Extract date part if timestamp
      const periodEndDate = period.end_date.split('T')[0] // Extract date part if timestamp
      
      // Set dates synchronously - these MUST match the period's dates from the database
      // The dates are stored in ISO format (YYYY-MM-DD) which is what the date input expects
      setPayCycleStart(periodStartDate)
      setPayCycleEnd(periodEndDate)

      // Load all projections and filter by period date range
      const allProjectionsRes = await getAllProjections()
      if (allProjectionsRes.data) {
        // Filter projections that fall within the period's date range
        const periodStart = new Date(period.start_date)
        const periodEnd = new Date(period.end_date)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setHours(23, 59, 59, 999)

        const filteredProjections = allProjectionsRes.data
          .filter(p => {
            const projDate = new Date(p.projection_date)
            projDate.setHours(0, 0, 0, 0)
            return projDate >= periodStart && projDate <= periodEnd
          })
          .map(p => ({
            ...p,
            entry_time: p.entry_time || '00:00:00'
          }))
          // Deduplicate
          .reduce((acc, current) => {
            const key = `${current.projection_date}-${current.days_remaining}-${current.entry_time}`
            const existing = acc.find(p => `${p.projection_date}-${p.days_remaining}-${p.entry_time}` === key)
            if (existing) {
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
            const timeA = a.entry_time || '00:00:00'
            const timeB = b.entry_time || '00:00:00'
            return timeB.localeCompare(timeA)
          })

        setProjections(filteredProjections)
      }

      // If period has a snapshot, load it
      if (period.snapshot_id) {
        // Find the snapshot
        const snapshot = monthlySnapshots.find(s => s.id === period.snapshot_id)
        if (snapshot) {
          // Load the snapshot data
          const res = await loadMonthlySnapshot(snapshot.month_year)
          if (res.error || !res.data) {
            toast.error('Failed to load period snapshot', { description: res.error || 'No snapshot found' })
            return
          }
          
          // Restore account balances
          for (const [accountId, balance] of Object.entries(res.data.account_balances)) {
            const account = accounts.find(a => a.id === accountId)
            if (account) {
              optimisticallyUpdateBalance(accountId, balance)
              debouncedUpdateBalance(accountId, balance)
            }
          }
          
          // Restore bill statuses
          const paymentsPaid: Record<string, number> = {}
          for (const [billId, status] of Object.entries(res.data.bill_statuses)) {
            if (typeof status === 'object' && status !== null) {
              if ('payments_paid' in status && typeof status.payments_paid === 'number') {
                paymentsPaid[billId] = status.payments_paid
              } else if ('paid' in status && status.paid === true) {
                paymentsPaid[billId] = 999
              }
            }
          }
          setBillPaymentsPaid(paymentsPaid)
        } else {
          toast.error('Period snapshot not found')
        }
      } else {
        // Period without snapshot - just reset bills if needed
        setBillPaymentsPaid({})
      }
      
      // Refresh billing periods list to ensure state is up-to-date
      const periodsRes = await getBillingPeriods()
      if (periodsRes.data) {
        setBillingPeriods(periodsRes.data)
      }
      
      // Set selected period ID - this must happen AFTER dates are set
      // This will trigger the useEffect that syncs dates, but dates are already set correctly above
      setSelectedBillingPeriodId(periodId)
      setSelectedMonthYear(getCurrentMonthYear()) // Reset to current month for display
      
      toast.success('Period loaded', {
        description: `${period.period_name}`
      })
    } catch (error) {
      console.error('Error loading billing period:', error)
      toast.error('Failed to load billing period')
    } finally {
      setIsLoading(false)
    }
  }, [user, billingPeriods, monthlySnapshots, accounts, optimisticallyUpdateBalance, debouncedUpdateBalance, selectedBillingPeriodId, billPaymentsPaid, bills, billsBreakdown, accountBalances, projection])

  // Add new projection row
  const handleAddProjectionRow = useCallback(() => {
    if (!user) return
    
    // CRITICAL: Use a date within the current period's range, not the actual "today"
    // This ensures projections created in a period (e.g., 2030) appear only in that period
    const periodStartDate = new Date(payCycleStart)
    periodStartDate.setHours(0, 0, 0, 0)
    const periodEndDate = new Date(payCycleEnd)
    periodEndDate.setHours(0, 0, 0, 0)
    const todayDate = new Date(today)
    todayDate.setHours(0, 0, 0, 0)
    
    // Use today if it falls within the period range, otherwise use period start
    // This allows creating projections for "today" when viewing current period,
    // but uses period start when viewing future/past periods
    let projectionDate: string
    if (todayDate >= periodStartDate && todayDate <= periodEndDate) {
      projectionDate = today
    } else {
      projectionDate = payCycleStart
    }
    
    const projectionDateObj = new Date(projectionDate)
    projectionDateObj.setHours(0, 0, 0, 0)
    const endDate = new Date(payCycleEnd)
    endDate.setHours(0, 0, 0, 0)
    const diffTime = endDate.getTime() - projectionDateObj.getTime()
    const daysRem = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // Validate that the projection date falls within the period range
    if (projectionDateObj < periodStartDate || projectionDateObj > periodEndDate) {
      toast.error('Cannot create projection', {
        description: `Projection date must be within the current period range (${payCycleStart} to ${payCycleEnd})`
      })
      return
    }
    
    const accountBalances: Record<string, number> = {}
    // Initialize account balances to 0
    for (const account of accounts) {
      accountBalances[account.id] = 0
    }
    
    // Calculate current bills remaining from bills breakdown (sum of all "Remaining This month")
    const currentBillsRemaining = billsBreakdown.reduce((sum, item) => sum + item.remainingThisMonth, 0)
    
    // Generate unique time for this entry (current time, or increment if multiple entries on this date)
    const now = new Date()
    const existingOnDate = projections.filter(p => p.projection_date === projectionDate && p.days_remaining === Math.max(0, daysRem))
    // Find the highest seconds value used for this date/days combination to ensure uniqueness
    let maxSeconds = now.getSeconds()
    existingOnDate.forEach(p => {
      if (p.entry_time) {
        const parts = p.entry_time.split(':')
        if (parts.length >= 3) {
          const seconds = parseInt(parts[2]) || 0
          maxSeconds = Math.max(maxSeconds, seconds)
        }
      }
    })
    // Use next second value to ensure uniqueness (handle overflow properly)
    const uniqueSeconds = (maxSeconds + 1) % 60
    const minutesCarry = Math.floor((maxSeconds + 1) / 60)
    const finalMinutes = (now.getMinutes() + minutesCarry) % 60
    const hoursCarry = Math.floor((now.getMinutes() + minutesCarry) / 60)
    const finalHours = (now.getHours() + hoursCarry) % 24
    const timeString = `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}:${uniqueSeconds.toString().padStart(2, '0')}`
    
    console.log('[SpendTracking] Creating projection:', {
      projectionDate,
      periodRange: `${payCycleStart} to ${payCycleEnd}`,
      daysRemaining: Math.max(0, daysRem),
      selectedBillingPeriodId,
      selectedMonthYear
    })
    
    const newProjection: Partial<FinanceProjection> & {
      projection_date: string
      days_remaining: number
      account_balances: Record<string, number>
      total_available: number
      bills_remaining: number
      cash_available: number
    } = {
      projection_date: projectionDate, // Use period-appropriate date, not always "today"
      days_remaining: Math.max(0, daysRem),
      entry_time: timeString, // Set to current time for uniqueness
      account_balances: accountBalances,
      total_available: 0,
      bills_remaining: currentBillsRemaining, // Use calculated value from bills breakdown
      cash_available: 0,
      cash_per_week: null,
      spending_per_day: null,
      notes: null,
    }
    
    startTransition(async () => {
      // With entry_time, we can have multiple rows per day, so check if exact same time exists
      const existingProjection = projections.find(p => 
        p.projection_date === projectionDate && 
        p.days_remaining === Math.max(0, daysRem) &&
        p.entry_time === timeString
      )
      const isUpdate = !!existingProjection
      
      hasClientModifications.current = true
      const res = await upsertProjection(newProjection)
      if (!res.error && res.data) {
        setProjections(prev => {
          // First, check if a projection with this ID already exists
          const existingById = prev.findIndex(p => p.id === res.data!.id)
          
          if (existingById >= 0) {
            // Update existing projection by ID
            const updated = [...prev]
            updated[existingById] = res.data!
            return updated.sort((a, b) => {
              const dateDiff = new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
              if (dateDiff !== 0) return dateDiff
              if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining
              // Sort by time descending (most recent first)
              const timeA = a.entry_time || '00:00:00'
              const timeB = b.entry_time || '00:00:00'
              return timeB.localeCompare(timeA)
            })
          }
          
          // Check if projection with same date/days_remaining/entry_time but different ID exists
          // This handles the case where upsert updated an existing row and returned its ID
          const existingByDateDaysTime = prev.findIndex(p => 
            p.projection_date === res.data!.projection_date && 
            p.days_remaining === res.data!.days_remaining &&
            (p.entry_time || '00:00:00') === (res.data!.entry_time || '00:00:00')
          )
          
          if (existingByDateDaysTime >= 0) {
            // Replace the existing one with the updated one (same unique constraint, different ID)
            const updated = [...prev]
            updated[existingByDateDaysTime] = res.data!
            // Remove any duplicates with the same ID or same unique constraint
            const seen = new Set<string>()
            const filtered = updated.filter(p => {
              const key = `${p.projection_date}-${p.days_remaining}-${p.entry_time || '00:00:00'}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            return filtered.sort((a, b) => {
              const dateDiff = new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
              if (dateDiff !== 0) return dateDiff
              if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining
              // Sort by time descending (most recent first)
              const timeA = a.entry_time || '00:00:00'
              const timeB = b.entry_time || '00:00:00'
              return timeB.localeCompare(timeA)
            })
          }
          
          // Add new projection (no existing match found)
          const updated = [...prev, res.data!]
          return updated.sort((a, b) => {
            const dateDiff = new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
            if (dateDiff !== 0) return dateDiff
            if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining
            // Sort by time descending (most recent first)
            const timeA = a.entry_time || '00:00:00'
            const timeB = b.entry_time || '00:00:00'
            return timeB.localeCompare(timeA)
          })
        })
        
        // Reload historical projections if they've been loaded (to keep them in sync)
        if (allHistoricalProjections.length > 0) {
          getAllProjections().then(result => {
            if (result.data) {
              setAllHistoricalProjections(result.data)
            }
          }).catch(() => {
            // Silently fail - historical data will reload when tab is opened
          })
        }
        
        // After adding/updating, filter projections to ensure only those in current period are shown
        // This prevents projections from "leaking" between periods
        const currentPeriodStart = new Date(payCycleStart)
        currentPeriodStart.setHours(0, 0, 0, 0)
        const currentPeriodEnd = new Date(payCycleEnd)
        currentPeriodEnd.setHours(23, 59, 59, 999)
        
        setProjections(prev => {
          // Filter to only include projections within the current period's date range
          return prev.filter(p => {
            const projDate = new Date(p.projection_date)
            projDate.setHours(0, 0, 0, 0)
            return projDate >= currentPeriodStart && projDate <= currentPeriodEnd
          })
        })
        
        toast.success(isUpdate ? 'Row updated' : 'Row added')
      } else {
        toast.error('Failed to add row', { description: res.error || 'Unknown error' })
      }
    })
  }, [user, accounts, today, payCycleStart, payCycleEnd, projections, billsBreakdown, allHistoricalProjections.length, selectedBillingPeriodId, selectedMonthYear])

  // Update projection
  const updateProjectionInDb = useCallback(async (projectionId: string, updates: Partial<FinanceProjection>) => {
    const projection = projections.find(p => p.id === projectionId)
    if (!projection) return

    const updatedProjection: Partial<FinanceProjection> & {
      projection_date: string
      days_remaining: number
      account_balances: Record<string, number>
      total_available: number
      bills_remaining: number
      cash_available: number
    } = {
      ...projection,
      ...updates,
    }

    hasClientModifications.current = true
    const res = await upsertProjection(updatedProjection)
    if (res.error) {
      // Don't reload on error - keep the optimistic update
      // Only show error if it's not a duplicate key (which might be a race condition)
      if (!res.error.includes('duplicate key')) {
        toast.error('Failed to update projection', { description: res.error })
      }
      // Don't revert the state - keep the optimistic update
      hasClientModifications.current = false
    } else if (res.data) {
      setProjections(prev => prev.map(p => p.id === projectionId ? res.data! : p))
      
      // Reload historical projections if they've been loaded (to keep them in sync)
      if (allHistoricalProjections.length > 0) {
        getAllProjections().then(result => {
          if (result.data) {
            setAllHistoricalProjections(result.data)
          }
        }).catch(() => {
          // Silently fail - historical data will reload when tab is opened
        })
      }
    }
  }, [projections, allHistoricalProjections.length])

  // Debounced projection update
  const debouncedUpdateProjection = useDebounce(updateProjectionInDb, 500)

  // Handle projection update
  const handleUpdateProjection = useCallback((projectionId: string, updates: Partial<FinanceProjection>) => {
    // Optimistically update immediately
    setProjections(prev => prev.map(p => p.id === projectionId ? { ...p, ...updates } : p))
    
    // Save to DB with debounce
    debouncedUpdateProjection(projectionId, updates)
  }, [debouncedUpdateProjection])

  // Delete projection
  const handleDeleteProjection = useCallback(async (projectionId: string) => {
    if (!user) return
    
    hasClientModifications.current = true
    const res = await deleteProjection(projectionId)
    if (res.error) {
      toast.error('Failed to delete projection', { description: res.error })
    } else {
      setProjections(prev => prev.filter(p => p.id !== projectionId))
      
      // Reload historical projections if they've been loaded (to keep them in sync)
      if (allHistoricalProjections.length > 0) {
        getAllProjections().then(result => {
          if (result.data) {
            setAllHistoricalProjections(result.data)
          }
        }).catch(() => {
          // Silently fail - historical data will reload when tab is opened
        })
      }
      
      toast.success('Row deleted')
    }
  }, [user, allHistoricalProjections.length])



  // Show loading state while auth is being checked
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Only show "Please sign in" if auth has finished loading and user is null
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Please sign in to access your finances</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-0 md:ml-[var(--outer-rail-width,64px)] px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-dvh flex flex-col overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Personal Finance Header */}
        <div className="mb-2 shrink-0">
          <h1 className="glass-text-primary text-lg font-semibold">
            Personal Finance - {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h1>
        </div>

        {/* Tabs Navigation - Specification-compliant structure */}
        <TabsGlass value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          {/* Tabs Header - Positioned at top with minimal padding (compact design) */}
          <div 
            className="glass-medium glass-legible p-1 mb-2 relative overflow-hidden shrink-0"
            style={{ borderRadius: '9999px' }}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-br from-purple-500/12 via-slate-900/60 to-indigo-500/12"
              style={{ borderRadius: '9999px' }}
            />
            
            <div className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 w-full overflow-x-auto">
              <TabsListGlass className="flex-nowrap">
                <TabsTriggerGlass value="current" className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">Current View</TabsTriggerGlass>
                <TabsTriggerGlass value="historical" className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">Historical</TabsTriggerGlass>
                <TabsTriggerGlass value="charts" className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">Charts</TabsTriggerGlass>
                <TabsTriggerGlass value="periods" className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">Periods</TabsTriggerGlass>
              </TabsListGlass>
            </div>
          </div>

          {/* Tab Contents - Full height, no top margin */}
          <div className="flex-1 min-h-0 min-w-0 relative">
            {/* Current View Tab */}
            <TabsContentGlass value="current" className="h-full">

        {/* Pay Cycle Header - Responsive layout */}
        <Card className="glass-large mb-2">
          <CardContent className="py-2 sm:py-1">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-2 sm:gap-x-1.5 sm:gap-y-0.5">
              <div className="flex items-center gap-1 sm:gap-0.5 w-full sm:w-auto">
                <Label htmlFor="today-date" className="glass-text-secondary text-xs whitespace-nowrap">Today&apos;s Date:</Label>
                <Input
                  id="today-date"
                  type="date"
                  value={today}
                  readOnly
                  className="flex-1 sm:w-32 glass-small h-8 sm:h-5 text-xs py-0"
                />
              </div>
              
              <div className="flex items-center gap-1 sm:gap-0.5 w-full sm:w-auto">
                <Label htmlFor="pay-start" className="glass-text-secondary text-xs whitespace-nowrap">Pay Cycle Start:</Label>
                <Input
                  id="pay-start"
                  type="date"
                  value={payCycleStart}
                  onChange={(e) => setPayCycleStart(e.target.value)}
                  className="flex-1 sm:w-32 glass-small h-8 sm:h-5 text-xs py-0"
                />
              </div>
              
              <div className="flex items-center gap-1 sm:gap-0.5 w-full sm:w-auto">
                <Label htmlFor="pay-end" className="glass-text-secondary text-xs whitespace-nowrap">Pay Cycle End:</Label>
                <Input
                  id="pay-end"
                  type="date"
                  value={payCycleEnd}
                  onChange={(e) => setPayCycleEnd(e.target.value)}
                  className="flex-1 sm:w-32 glass-small h-8 sm:h-5 text-xs py-0"
                />
              </div>
              
              <div className="glass-small px-2 sm:px-1.5 py-1 sm:py-0 h-8 sm:h-5 rounded flex items-center">
                <span className="glass-text-secondary text-xs whitespace-nowrap">Days this cycle:</span>
                <span className="glass-text-primary text-xs font-semibold ml-1 sm:ml-0.5">{payCycleDays}</span>
              </div>
              
              <div className="glass-small px-2 sm:px-1.5 py-1 sm:py-0 h-8 sm:h-5 rounded flex items-center">
                <span className="glass-text-secondary text-xs whitespace-nowrap">Days remaining:</span>
                <span className="glass-text-primary text-xs font-semibold ml-1 sm:ml-0.5">{daysRemaining}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Balance Requirements + Date in responsive row */}
        <Card className="glass-large mb-2">
          <CardContent className="py-2 sm:py-1">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-start gap-2 sm:gap-x-1.5 sm:gap-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="glass-text-secondary text-xs font-medium">Account Balance Requirements:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-small text-xs h-8 sm:h-6"
                  onClick={() => setIsAddAccountDialogOpen(true)}
                >
                  + Add Account
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2 sm:gap-x-1.5 sm:gap-y-0.5 items-center">
                {accounts.map(account => {
                  const required = accountRequirements[account.id] || 0
                  // Only show accounts with requirements > 0
                  if (required <= 0) return null
                  return (
                    <div key={account.id} className="flex items-center gap-1 sm:gap-0.5">
                      <span className="glass-text-primary text-xs truncate max-w-[100px] sm:max-w-[70px]">{account.name}:</span>
                      <span className="text-xs font-semibold whitespace-nowrap text-green-600 dark:text-green-400">
                        {formatCurrency(required)}
                      </span>
                    </div>
                  )
                })}
                {accounts.filter(acc => (accountRequirements[acc.id] || 0) > 0).length === 0 && (
                  <span className="glass-text-tertiary text-xs">No requirements</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Summary - Responsive layout */}
        <Card className="glass-large mb-2">
          <CardContent className="py-2 sm:py-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-x-3 sm:gap-y-0.5">
              <div className="flex items-center gap-1 sm:gap-0.5">
                <span className="glass-text-secondary text-xs">Total Available:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.totalAvailable)}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-0.5">
                <span className="glass-text-secondary text-xs">Bills Remaining:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.billsRemaining)}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-0.5">
                <span className="glass-text-secondary text-xs">Cash Available:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.cashAvailable)}</span>
              </div>
              {projection.cashPerWeek !== null && (
                <div className="flex items-center gap-1 sm:gap-0.5">
                  <span className="glass-text-secondary text-xs">Cash per Week:</span>
                  <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.cashPerWeek)}</span>
                </div>
              )}
              {projection.spendingPerDay !== null && (
                <div className="flex items-center gap-1 sm:gap-0.5">
                  <span className="glass-text-secondary text-xs">Spending per Day:</span>
                  <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.spendingPerDay)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bills Breakdown Section */}
        <Card className="glass-large mb-2">
          <CardHeader className="py-2 sm:py-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <CardTitle className="glass-text-primary text-xs font-semibold">Bills Breakdown</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="glass-small text-xs h-8 sm:h-6 w-full sm:w-auto"
              onClick={() => {
                setEditingBill(null)
                setIsAddBillDialogOpen(true)
              }}
            >
              + Add Bill
            </Button>
          </CardHeader>
          <CardContent className="py-1">
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <div className="min-w-full inline-block">
                <table className="w-full text-xs min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('paymentDate')}
                      title="Double-click to sort"
                    >
                      Payment Date {billsSortColumn === 'paymentDate' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('company')}
                      title="Double-click to sort"
                    >
                      Company {billsSortColumn === 'company' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('amountCharged')}
                      title="Double-click to sort"
                    >
                      Amount Charged {billsSortColumn === 'amountCharged' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('typicalAmount')}
                      title="Double-click to sort"
                    >
                      Typical amount {billsSortColumn === 'typicalAmount' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('chargeCycle')}
                      title="Double-click to sort"
                    >
                      Charge Cycle {billsSortColumn === 'chargeCycle' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('multiplier')}
                      title="Double-click to sort"
                    >
                      Multiplier {billsSortColumn === 'multiplier' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('paymentDay')}
                      title="Double-click to sort"
                    >
                      Payment Day {billsSortColumn === 'paymentDay' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('weeksRemaining')}
                      title="Double-click to sort"
                    >
                      Weeks Remaining {billsSortColumn === 'weeksRemaining' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('totalWeeklyCost')}
                      title="Double-click to sort"
                    >
                      Total Weekly Cost {billsSortColumn === 'totalWeeklyCost' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('totalMonthlyCost')}
                      title="Double-click to sort"
                    >
                      Total Monthly Cost {billsSortColumn === 'totalMonthlyCost' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('remainingThisMonth')}
                      title="Double-click to sort"
                    >
                      Remaining This month {billsSortColumn === 'remainingThisMonth' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('billingAccount')}
                      title="Double-click to sort"
                    >
                      Billing account {billsSortColumn === 'billingAccount' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium w-12 cursor-pointer hover:bg-white/5 select-none"
                      onDoubleClick={() => handleBillsColumnSort('paid')}
                      title="Double-click to sort"
                    >
                      Paid {billsSortColumn === 'paid' && (billsSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium w-10">Edit</th>
                    <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium w-10">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBillsBreakdown.map((item) => {
                    // Find the full FinanceBill from the bills array
                    const fullBill = bills.find(b => b.id === item.bill.id)
                    if (!fullBill) return null
                    
                    return (
                      <BillRow
                        key={item.bill.id}
                        billWithRemaining={item}
                        accounts={accounts}
                        accountsMap={accountsMap}
                        onUpdatePaymentsPaid={handleUpdatePaymentsPaid}
                        onUpdate={handleUpdateBill}
                        onDelete={handleDeleteBill}
                      onEdit={(fullBill) => {
                        setEditingBill(fullBill)
                        setIsAddBillDialogOpen(true)
                      }}
                      fullBill={fullBill}
                      />
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={4} className="py-1 px-1.5 text-right glass-text-secondary text-xs font-medium">Total:</td>
                    <td colSpan={4} className="py-1 px-1.5"></td>
                    <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-semibold">
                      {formatCurrency(billsBreakdownTotals.totalWeeklyCost)}
                    </td>
                    <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-semibold">
                      {formatCurrency(billsBreakdownTotals.totalMonthlyCost)}
                    </td>
                    <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-semibold">
                      {formatCurrency(billsBreakdownTotals.remainingThisMonth)}
                    </td>
                    <td colSpan={4} className="py-1 px-1.5"></td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spend Tracking Section */}
        <Card className="glass-large mb-2">
          <CardHeader className="py-2 sm:py-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <CardTitle className="glass-text-primary text-xs font-semibold">Spend Tracking</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="glass-small text-xs h-8 sm:h-6 w-full sm:w-auto"
              onClick={handleAddProjectionRow}
            >
              + Add Row
            </Button>
          </CardHeader>
          <CardContent className="py-1">
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <div className="min-w-full inline-block">
                <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {spendTrackingColumnOrder.map(columnId => {
                      // Time column
                      if (columnId === 'time') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Time
                          </th>
                        )
                      }
                      // Days Remaining column
                      if (columnId === 'daysRemaining') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Days Remaining
                          </th>
                        )
                      }
                      // Account columns
                      if (columnId.startsWith('account_')) {
                        const accountId = columnId.replace('account_', '')
                        const account = accounts.find(a => a.id === accountId)
                        if (!account) return null
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            {account.name}
                          </th>
                        )
                      }
                      // Total column
                      if (columnId === 'total') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10 cursor-move hover:bg-white/15 select-none"
                            title="Drag to reorder columns"
                          >
                            Total
                          </th>
                        )
                      }
                      // Bills Remaining column
                      if (columnId === 'billsRemaining') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10 cursor-move hover:bg-white/15 select-none"
                            title="Drag to reorder columns"
                          >
                            Bills Remaining (enter)
                          </th>
                        )
                      }
                      // Cash Available column
                      if (columnId === 'cashAvailable') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10 cursor-move hover:bg-white/15 select-none"
                            title="Drag to reorder columns"
                          >
                            Cash Available
                          </th>
                        )
                      }
                      // Cash per week column
                      if (columnId === 'cashPerWeek') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10 cursor-move hover:bg-white/15 select-none"
                            title="Drag to reorder columns"
                          >
                            Cash per week
                          </th>
                        )
                      }
                      // Left Over if only spend 450 per week column
                      if (columnId === 'leftOver450') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Left Over if only spend 450 per week
                          </th>
                        )
                      }
                      // Min amount needed column
                      if (columnId === 'minAmountNeeded') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Min amount needed
                          </th>
                        )
                      }
                      // Spending available per day column
                      if (columnId === 'spendingPerDay') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Spending available per day
                          </th>
                        )
                      }
                      // Notes column
                      if (columnId === 'notes') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Notes
                          </th>
                        )
                      }
                      // Delete column
                      if (columnId === 'delete') {
                        return (
                          <th
                            key={columnId}
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            onDragOver={handleColumnDragOver}
                            onDrop={(e) => handleColumnDrop(e, columnId)}
                            className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium w-10 cursor-move hover:bg-white/10 select-none"
                            title="Drag to reorder columns"
                          >
                            Delete
                          </th>
                        )
                      }
                      return null
                    })}
                  </tr>
                </thead>
                <tbody>
                  {projections.map((projection, index) => (
                    <ProjectionRow
                      key={`${projection.id}-${projection.projection_date}-${projection.days_remaining}-${projection.entry_time || '00:00:00'}-${index}`}
                      projection={projection}
                      accounts={accounts}
                      columnOrder={spendTrackingColumnOrder}
                      rowIndex={index}
                      allProjections={projections}
                      onUpdate={handleUpdateProjection}
                      onDelete={handleDeleteProjection}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            className="glass-small text-xs"
            onClick={handleSaveSnapshot}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Snapshot'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="glass-small text-xs"
            onClick={handleCreateNextPeriod}
            disabled={isCreatingNextPeriod}
          >
            {isCreatingNextPeriod ? 'Creating...' : 'Create Next Billing Period'}
          </Button>
          <Select
            value={selectedBillingPeriodId || selectedMonthYear}
            onValueChange={async (value) => {
              // Check if it's a billing period ID or a month_year
              const period = billingPeriods.find(p => p.id === value)
              if (period) {
                await handleLoadBillingPeriod(value)
              } else {
                // It's a month_year (snapshot) - need to set pay cycle dates for this month and load snapshot
                
                // Parse monthYear (format: "YYYY-MM") and calculate pay cycle dates
                const [year, month] = value.split('-').map(Number)
                const monthIndex = month - 1 // JavaScript months are 0-indexed
                
                // Calculate pay cycle: 14th of this month to 12th of next month
                const startDate = new Date(year, monthIndex, 14)
                const endDate = new Date(year, monthIndex + 1, 12)
                
                const startDateStr = startDate.toISOString().split('T')[0]
                const endDateStr = endDate.toISOString().split('T')[0]
                
                // CRITICAL: Load snapshot FIRST, then set dates
                // This ensures payment statuses are restored BEFORE dates trigger breakdown recalculation
                setIsLoading(true)
                
                try {
                  // Load snapshot to restore payment statuses and account balances FIRST
                  await handleLoadSnapshot(value)
                  
                  // NOW set the dates - this will trigger breakdown recalculation with the restored payment statuses
                  setPayCycleStart(startDateStr)
                  setPayCycleEnd(endDateStr)
                  setSelectedBillingPeriodId(null)
                  setSelectedMonthYear(value)
                } finally {
                  setIsLoading(false)
                }
                
                // Reload projections filtered by pay cycle date range (not just month)
                // This ensures the Spend Tracking table shows projections for the correct period
                console.log('[SpendTracking] Reloading projections for date range:', {
                  monthYear: value,
                  startDateStr,
                  endDateStr
                })
                const allProjectionsRes = await getAllProjections()
                if (allProjectionsRes.data) {
                  // Filter projections that fall within the pay cycle date range
                  const cycleStart = new Date(startDateStr)
                  const cycleEnd = new Date(endDateStr)
                  cycleStart.setHours(0, 0, 0, 0)
                  cycleEnd.setHours(23, 59, 59, 999)
                  
                  const filteredProjections = allProjectionsRes.data
                    .filter(p => {
                      const projDate = new Date(p.projection_date)
                      projDate.setHours(0, 0, 0, 0)
                      return projDate >= cycleStart && projDate <= cycleEnd
                    })
                    .map(p => ({
                      ...p,
                      entry_time: p.entry_time || '00:00:00'
                    }))
                    // Deduplicate
                    .reduce((acc, current) => {
                      const key = `${current.projection_date}-${current.days_remaining}-${current.entry_time}`
                      const existing = acc.find(p => `${p.projection_date}-${p.days_remaining}-${p.entry_time}` === key)
                      if (existing) {
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
                      const timeA = a.entry_time || '00:00:00'
                      const timeB = b.entry_time || '00:00:00'
                      return timeB.localeCompare(timeA)
                    })
                  
                  console.log('[SpendTracking] Filtered projections:', {
                    totalProjections: allProjectionsRes.data.length,
                    filteredCount: filteredProjections.length,
                    dateRange: `${startDateStr} to ${endDateStr}`
                  })
                  setProjections(filteredProjections)
                }
                
                // Reload billing periods list (but don't reset payment statuses)
                const periodsRes = await getBillingPeriods()
                if (periodsRes.data) {
                  setBillingPeriods(periodsRes.data)
                }
              }
            }}
          >
            <SelectTrigger className="w-48 glass-small text-xs h-6">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {/* Billing Periods */}
              {billingPeriods.length > 0 && (
                <>
                  {billingPeriods.map(period => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.period_name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs glass-text-secondary border-t border-white/10 mt-1">
                    Snapshots:
                  </div>
                </>
              )}
              {/* Monthly Snapshots */}
              {monthlySnapshots.map(snapshot => (
                <SelectItem key={snapshot.month_year} value={snapshot.month_year}>
                  {snapshot.month_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
            </TabsContentGlass>

            {/* Historical Spend Tracking Tab */}
            <TabsContentGlass value="historical" className="h-full">
              <HistoricalSpendTrackingTab 
                initialProjections={allHistoricalProjections}
              />
            </TabsContentGlass>

            {/* Chart Analysis Tab */}
            <TabsContentGlass value="charts" className="h-full">
              <ChartAnalysisTab 
                initialProjections={allHistoricalProjections}
                initialAccounts={accounts}
                initialBills={bills}
              />
            </TabsContentGlass>

            {/* Billing Period Manager Tab */}
            <TabsContentGlass value="periods" className="h-full">
              <BillingPeriodManagerTab 
                initialPeriods={[]}
                initialSnapshots={monthlySnapshots}
              />
            </TabsContentGlass>
          </div>
        </TabsGlass>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
        <DialogContentGlass>
          <DialogHeaderGlass>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>Create a new financial account</DialogDescription>
          </DialogHeaderGlass>
          <AddAccountDialog
            onClose={() => setIsAddAccountDialogOpen(false)}
            onSubmit={handleAddAccount}
          />
        </DialogContentGlass>
      </Dialog>

      {/* Add/Edit Bill Dialog */}
      <Dialog 
        open={isAddBillDialogOpen} 
        onOpenChange={(open) => {
          // Only allow closing if not submitting
          if (!open) {
            setIsAddBillDialogOpen(false)
            setEditingBill(null)
          }
        }}
      >
        <DialogContentGlass>
          <DialogHeaderGlass>
            <DialogTitle>{editingBill ? 'Edit Bill' : 'Add Bill'}</DialogTitle>
            <DialogDescription>
              {editingBill ? 'Update bill information' : 'Create a new recurring bill'}
            </DialogDescription>
          </DialogHeaderGlass>
          <AddBillDialog
            key={editingBill?.id || 'new'}
            bill={editingBill}
            accounts={accounts}
            onClose={() => {
              setIsAddBillDialogOpen(false)
              setEditingBill(null)
            }}
            onSubmit={handleAddBill}
          />
        </DialogContentGlass>
      </Dialog>

      {/* Create Next Period Dialog */}
      <Dialog open={isCreateNextPeriodDialogOpen} onOpenChange={setIsCreateNextPeriodDialogOpen}>
        <DialogContentGlass className="max-w-md">
          <DialogHeaderGlass>
            <DialogTitle>Create Next Billing Period</DialogTitle>
            <DialogDescription>
              Set up a new billing period with start and end dates
            </DialogDescription>
          </DialogHeaderGlass>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="period_title">Period Title</Label>
              <Input
                id="period_title"
                value={nextPeriodForm.title}
                onChange={(e) =>
                  setNextPeriodForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g., January 2025 Budget"
                className="glass-small"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period_start_date">Start Date</Label>
                <Input
                  id="period_start_date"
                  type="date"
                  value={nextPeriodForm.start_date}
                  onChange={(e) =>
                    setNextPeriodForm((prev) => ({ ...prev, start_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end_date">End Date</Label>
                <Input
                  id="period_end_date"
                  type="date"
                  value={nextPeriodForm.end_date}
                  onChange={(e) =>
                    setNextPeriodForm((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reset_bills"
                checked={nextPeriodForm.reset_bills}
                onCheckedChange={(checked) =>
                  setNextPeriodForm((prev) => ({ ...prev, reset_bills: checked === true }))
                }
              />
              <Label
                htmlFor="reset_bills"
                className="text-sm font-normal cursor-pointer"
              >
                Reset all bills to unpaid
              </Label>
            </div>
          </div>
          <DialogFooterGlass>
            <Button
              variant="ghost"
              onClick={() => setIsCreateNextPeriodDialogOpen(false)}
              disabled={isCreatingNextPeriod}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNextPeriodSubmit}
              disabled={isCreatingNextPeriod}
              className="glass-small"
            >
              {isCreatingNextPeriod ? 'Creating...' : 'Create Period'}
            </Button>
          </DialogFooterGlass>
        </DialogContentGlass>
      </Dialog>
    </div>
  )
}

// Add Account Dialog Component
function AddAccountDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (name: string, accountType: FinanceAccount['account_type'], balance: number) => void
}) {
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'credit' | 'investment' | 'other'>('checking')
  const [balance, setBalance] = useState('0')
  const [currency, setCurrency] = useState('AUD')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      onSubmit(name.trim(), accountType, parseFloat(balance) || 0)
      // Reset form
      setName('')
      setBalance('0')
      setAccountType('checking')
      setCurrency('AUD')
    } catch (err) {
      console.error('Failed to create account:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [name, accountType, balance, onSubmit])

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 flex-1 overflow-y-auto">
      <div className="space-y-1">
        <Label htmlFor="account-name" className="glass-text-primary text-xs">Account Name</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Orange One, Everyday Spending"
          className="glass-small"
          required
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="account-type" className="glass-text-primary text-xs">Account Type</Label>
        <Select value={accountType} onValueChange={(v) => setAccountType(v as typeof accountType)}>
          <SelectTrigger id="account-type" className="glass-small">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="account-balance" className="glass-text-primary text-xs">Initial Balance</Label>
        <Input
          id="account-balance"
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="0.00"
          className="glass-small"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="account-currency" className="glass-text-primary text-xs">Currency</Label>
        <Input
          id="account-currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="AUD"
          className="glass-small"
          maxLength={3}
          required
        />
      </div>
      <DialogFooterGlass>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="glass-small"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="glass-small"
        >
          {isSubmitting ? 'Adding...' : 'Add Account'}
        </Button>
      </DialogFooterGlass>
    </form>
  )
}

// Add Bill Dialog Component
function AddBillDialog({
  accounts,
  bill,
  onClose,
  onSubmit,
}: {
  accounts: FinanceAccount[]
  bill?: FinanceBill | null
  onClose: () => void
  onSubmit: (billData: Partial<FinanceBill>) => void
}) {
  // Initialize state from bill prop if available, otherwise use defaults
  const [companyName, setCompanyName] = useState(bill?.company_name || '')
  const [amount, setAmount] = useState(bill?.amount?.toString() || '0')
  const [typicalAmount, setTypicalAmount] = useState(bill?.typical_amount?.toString() || '')
  const [chargeCycle, setChargeCycle] = useState<'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'>(bill?.charge_cycle || 'monthly')
  const [multiplierType, setMultiplierType] = useState<'monthly' | 'weekly' | 'one_off'>(bill?.multiplier_type || 'monthly')
  const [paymentDay, setPaymentDay] = useState<string>(bill?.payment_day !== null && bill?.payment_day !== undefined ? bill.payment_day.toString() : '')
  const [nextDueDate, setNextDueDate] = useState(() => {
    if (bill?.next_due_date) {
      return bill.next_due_date
    }
    const date = new Date()
    date.setDate(1) // First of current month as default
    return date.toISOString().split('T')[0]
  })
  const [billingAccountId, setBillingAccountId] = useState<string>(bill?.billing_account_id || '')
  const [category, setCategory] = useState(bill?.category || '')
  const [dayOfMonthInput, setDayOfMonthInput] = useState<string>(() => {
    if (bill?.multiplier_type === 'monthly' && bill?.next_due_date) {
      return new Date(bill.next_due_date).getDate().toString()
    }
    return '1'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Update form when bill prop changes
  useEffect(() => {
    if (bill) {
      setCompanyName(bill.company_name || '')
      setAmount(bill.amount?.toString() || '0')
      setTypicalAmount(bill.typical_amount?.toString() || '')
      setChargeCycle(bill.charge_cycle || 'monthly')
      setMultiplierType(bill.multiplier_type || 'monthly')
      setPaymentDay(bill.payment_day !== null && bill.payment_day !== undefined ? bill.payment_day.toString() : '')
      setNextDueDate(bill.next_due_date || new Date().toISOString().split('T')[0])
      setBillingAccountId(bill.billing_account_id || '')
      setCategory(bill.category || '')
      if (bill.multiplier_type === 'monthly' && bill.next_due_date) {
        const day = new Date(bill.next_due_date).getDate()
        setDayOfMonthInput(day.toString())
      } else if (bill.multiplier_type !== 'monthly') {
        setDayOfMonthInput('1')
      }
    } else {
      // Reset form for new bill
      setCompanyName('')
      setAmount('0')
      setTypicalAmount('')
      setChargeCycle('monthly')
      setMultiplierType('monthly')
      setPaymentDay('')
      setNextDueDate(() => {
        const date = new Date()
        date.setDate(1)
        return date.toISOString().split('T')[0]
      })
      setBillingAccountId('')
      setCategory('')
      setDayOfMonthInput('1')
    }
  }, [bill])
  
  // Initialize dayOfMonthInput when multiplierType changes to monthly
  useEffect(() => {
    if (multiplierType === 'monthly' && !dayOfMonthInput) {
      const day = nextDueDate ? new Date(nextDueDate).getDate() : new Date().getDate()
      setDayOfMonthInput(day.toString())
    }
  }, [multiplierType, nextDueDate, dayOfMonthInput])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent dialog from closing
    
    if (!companyName.trim() || !amount || parseFloat(amount) <= 0) {
      toast.error('Validation failed', {
        description: 'Please fill in company name and amount'
      })
      return
    }
    if (multiplierType === 'weekly' && !paymentDay) {
      toast.error('Payment day required', {
        description: 'Please select a payment day for weekly bills'
      })
      return
    }

    setIsSubmitting(true)
    try {
      // For monthly bills, ensure next_due_date has the correct day of month
      let finalNextDueDate = nextDueDate
      if (multiplierType === 'monthly') {
        const baseDate = new Date(nextDueDate)
        // Keep the day of month from nextDueDate (it should already be set correctly)
        finalNextDueDate = baseDate.toISOString().split('T')[0]
      }
      
      await onSubmit({
        id: bill?.id, // Include bill ID if editing
        company_name: companyName.trim(),
        amount: parseFloat(amount),
        typical_amount: typicalAmount.trim() ? parseFloat(typicalAmount) : null,
        charge_cycle: chargeCycle,
        next_due_date: finalNextDueDate,
        billing_account_id: billingAccountId || null,
        category: category.trim() || null,
        multiplier_type: multiplierType,
        payment_day: multiplierType === 'weekly' && paymentDay ? parseInt(paymentDay) : null,
      })
    } catch (err) {
      console.error('Failed to create bill:', err)
      toast.error('Failed to save bill', {
        description: err instanceof Error ? err.message : 'An error occurred'
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [companyName, amount, typicalAmount, chargeCycle, nextDueDate, billingAccountId, category, multiplierType, paymentDay, bill?.id, onSubmit])

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 flex-1 overflow-y-auto">
      <div className="space-y-1">
        <Label htmlFor="bill-company" className="glass-text-primary text-xs">Company Name</Label>
        <Input
          id="bill-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g., Synergy Electricity, TPG Internet"
          className="glass-small"
          required
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="bill-amount" className="glass-text-primary text-xs">Amount Charged</Label>
          <Input
            id="bill-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="glass-small"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bill-typical-amount" className="glass-text-primary text-xs">
            Typical Amount
            <span className="glass-text-tertiary text-[10px] ml-1">(optional, reference only)</span>
          </Label>
          <Input
            id="bill-typical-amount"
            type="number"
            step="0.01"
            value={typicalAmount}
            onChange={(e) => setTypicalAmount(e.target.value)}
            placeholder="0.00"
            className="glass-small"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="bill-cycle" className="glass-text-primary text-xs">Charge Cycle</Label>
        <Select value={chargeCycle} onValueChange={(v) => setChargeCycle(v as typeof chargeCycle)}>
          <SelectTrigger id="bill-cycle" className="glass-small">
            <SelectValue placeholder="Select charge cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Bi-weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="bimonthly">Bi-monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="semiannual">Semi-annual</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Multiplier Type */}
      <div className="space-y-1">
        <Label htmlFor="bill-multiplier" className="glass-text-primary text-xs">Multiplier Type</Label>
        <Select value={multiplierType} onValueChange={(v) => setMultiplierType(v as 'monthly' | 'weekly' | 'one_off')}>
          <SelectTrigger id="bill-multiplier" className="glass-small">
            <SelectValue placeholder="Select multiplier type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="one_off">One off</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Payment Day (only for weekly) */}
      {multiplierType === 'weekly' && (
        <div className="space-y-1">
          <Label htmlFor="bill-payment-day" className="glass-text-primary text-xs">Payment Day (Day of Week)</Label>
          <Select value={paymentDay} onValueChange={setPaymentDay}>
            <SelectTrigger id="bill-payment-day" className="glass-small">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="2">Tuesday</SelectItem>
              <SelectItem value="3">Wednesday</SelectItem>
              <SelectItem value="4">Thursday</SelectItem>
              <SelectItem value="5">Friday</SelectItem>
              <SelectItem value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Payment Date - Different input based on multiplier type */}
      <div className="space-y-1">
        <Label htmlFor="bill-payment-date" className="glass-text-primary text-xs">
          {multiplierType === 'monthly' ? 'Day of Month (1-31)' : multiplierType === 'one_off' ? 'Payment Date' : 'Next Due Date'}
        </Label>
        {multiplierType === 'monthly' ? (
          <Input
            id="bill-payment-date"
            type="number"
            min="1"
            max="31"
            value={dayOfMonthInput}
            onChange={(e) => {
              const value = e.target.value
              // Allow empty string while typing
              if (value === '') {
                setDayOfMonthInput('')
                return
              }
              // Only allow numeric input
              const numericValue = value.replace(/[^0-9]/g, '')
              if (numericValue === '') {
                setDayOfMonthInput('')
                return
              }
              // Allow any numeric input while typing (validation happens on blur)
              setDayOfMonthInput(numericValue)
            }}
            onBlur={(e) => {
              // Validate and fix on blur, then update nextDueDate
              const day = parseInt(e.target.value) || 1
              const validDay = Math.max(1, Math.min(31, day))
              setDayOfMonthInput(validDay.toString())
              
              // Update nextDueDate with the validated day
              const baseDate = new Date(nextDueDate || new Date())
              const newDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), validDay)
              setNextDueDate(newDate.toISOString().split('T')[0])
            }}
            className="glass-small"
            required
            placeholder="e.g., 21 for 21st of month"
          />
        ) : (
          <Input
            id="bill-payment-date"
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="glass-small"
            required
          />
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="bill-account" className="glass-text-primary text-xs">Billing Account (Optional)</Label>
        <Select value={billingAccountId || '__none__'} onValueChange={(value) => setBillingAccountId(value === '__none__' ? '' : value)}>
          <SelectTrigger id="bill-account" className="glass-small">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="bill-category" className="glass-text-primary text-xs">Category (Optional)</Label>
        <Input
          id="bill-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., utilities, insurance, subscriptions"
          className="glass-small"
        />
      </div>
      <DialogFooterGlass>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="glass-small"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting || 
            !companyName.trim() || 
            !amount || 
            parseFloat(amount) <= 0 ||
            (multiplierType === 'weekly' && !paymentDay)
          }
          className="glass-small"
          onClick={(e) => {
            // Prevent event from bubbling up to dialog
            e.stopPropagation()
          }}
        >
          {isSubmitting ? (bill ? 'Updating...' : 'Adding...') : (bill ? 'Update Bill' : 'Add Bill')}
        </Button>
      </DialogFooterGlass>
    </form>
  )
}

// Bill Row Component
const BillRow = memo(({
  billWithRemaining,
  accounts,
  accountsMap,
  onUpdatePaymentsPaid,
  onUpdate,
  onDelete,
  onEdit,
  fullBill,
}: {
  billWithRemaining: BillWithRemaining
  accounts: FinanceAccount[]
  accountsMap: Map<string, FinanceAccount>
  onUpdatePaymentsPaid: (billId: string, paymentsPaid: number, totalPayments: number) => void
  onUpdate: (billId: string, updates: Partial<FinanceBill>) => void
  onDelete: (billId: string) => void
  onEdit: (bill: FinanceBill) => void
  fullBill: FinanceBill
}) => {
  const bill = billWithRemaining.bill
  
  // Editable field states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempCompanyName, setTempCompanyName] = useState(bill.company_name)
  const [tempAmount, setTempAmount] = useState(bill.amount.toString())
  const [tempTypicalAmount, setTempTypicalAmount] = useState(bill.typical_amount?.toString() || '')
  const [tempChargeCycle, setTempChargeCycle] = useState(bill.charge_cycle)
  const [tempNextDueDate, setTempNextDueDate] = useState(bill.next_due_date)
  const [tempBillingAccountId, setTempBillingAccountId] = useState(bill.billing_account_id ?? '')
  const [tempCategory, setTempCategory] = useState(bill.category ?? '')
  const [tempMultiplierType, setTempMultiplierType] = useState<'monthly' | 'weekly' | 'one_off'>(bill.multiplier_type || 'monthly')
  const [tempPaymentDay, setTempPaymentDay] = useState<string>((bill.payment_day ?? '').toString())

  // Sync local state when bill changes - use ref to track previous bill to avoid unnecessary updates
  const prevBillRef = useRef(bill.id)
  
  useEffect(() => {
    // Only update if bill ID changed (new bill selected)
    if (prevBillRef.current !== bill.id) {
      prevBillRef.current = bill.id
      // Batch state updates using React.startTransition to avoid cascading renders
      React.startTransition(() => {
        setTempCompanyName(bill.company_name)
        setTempAmount(bill.amount.toString())
        setTempTypicalAmount(bill.typical_amount?.toString() || '')
        setTempChargeCycle(bill.charge_cycle)
        setTempNextDueDate(bill.next_due_date)
        setTempBillingAccountId(bill.billing_account_id ?? '')
        setTempCategory(bill.category ?? '')
        setTempMultiplierType(bill.multiplier_type || 'monthly')
        setTempPaymentDay((bill.payment_day ?? '').toString())
      })
    }
  }, [bill])

  // Format next due date for display
  const nextDueDisplay = useMemo(() => {
    return formatNextDueDate(bill.next_due_date, bill.charge_cycle)
  }, [bill.next_due_date, bill.charge_cycle])

  // Get current payment status
  const paymentsPaid = billWithRemaining.paymentsPaid || 0
  const totalPayments = billWithRemaining.totalPayments || 1

  const handlePaymentsPaidChange = useCallback((value: string) => {
    const newPaymentsPaid = parseInt(value, 10)
    onUpdatePaymentsPaid(bill.id, newPaymentsPaid, totalPayments)
  }, [bill.id, totalPayments, onUpdatePaymentsPaid])

  // Handle saving on blur
  const handleSaveField = useCallback((field: string) => {
    setEditingField(null)
    
    const updates: Partial<FinanceBill> = {}
    
    switch (field) {
      case 'company_name':
        if (tempCompanyName.trim() !== bill.company_name) {
          updates.company_name = tempCompanyName.trim()
        }
        break
      case 'amount':
        const newAmount = parseFloat(tempAmount)
        if (!isNaN(newAmount) && newAmount !== bill.amount) {
          updates.amount = newAmount
        } else {
          setTempAmount(bill.amount.toString())
        }
        break
      case 'typical_amount':
        const newTypicalAmount = tempTypicalAmount.trim() ? parseFloat(tempTypicalAmount) : null
        if ((newTypicalAmount === null || !isNaN(newTypicalAmount)) && newTypicalAmount !== (bill.typical_amount ?? null)) {
          updates.typical_amount = newTypicalAmount
        } else {
          setTempTypicalAmount(bill.typical_amount?.toString() || '')
        }
        break
      case 'charge_cycle':
        if (tempChargeCycle !== bill.charge_cycle) {
          updates.charge_cycle = tempChargeCycle
        }
        break
      case 'next_due_date':
        if (tempNextDueDate !== bill.next_due_date) {
          updates.next_due_date = tempNextDueDate
        }
        break
      case 'billing_account_id':
        const accountId = tempBillingAccountId || null
        if (accountId !== (bill.billing_account_id ?? null)) {
          updates.billing_account_id = accountId
        }
        break
      case 'category':
        const categoryValue = tempCategory.trim() || null
        if (categoryValue !== (bill.category ?? null)) {
          updates.category = categoryValue
        }
        break
      case 'payment_day':
        const paymentDayValue = tempPaymentDay ? parseInt(tempPaymentDay) : null
        if (paymentDayValue !== (bill.payment_day ?? null)) {
          updates.payment_day = paymentDayValue
        }
        break
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(bill.id, updates)
    }
  }, [bill, tempCompanyName, tempAmount, tempTypicalAmount, tempChargeCycle, tempNextDueDate, tempBillingAccountId, tempCategory, tempPaymentDay, onUpdate])

  const accountName = bill.billing_account_id ? accountsMap.get(bill.billing_account_id)?.name : undefined

  return (
    <tr className={`border-b border-white/5 hover:bg-white/5 transition-colors ${billWithRemaining.paymentsPaid >= billWithRemaining.totalPayments ? 'opacity-50' : ''}`}>
      {/* Next Due Date / Payment Date - Editable */}
      <td className="py-1 px-1.5">
        {editingField === 'next_due_date' ? (
          <div className="flex flex-col">
            {tempMultiplierType === 'monthly' ? (
              <Input
                type="number"
                min="1"
                max="31"
                value={tempNextDueDate ? new Date(tempNextDueDate).getDate() : ''}
                onChange={(e) => {
                  const dayOfMonth = parseInt(e.target.value)
                  if (dayOfMonth >= 1 && dayOfMonth <= 31) {
                    const currentDate = new Date(tempNextDueDate || new Date())
                    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth)
                    setTempNextDueDate(newDate.toISOString().split('T')[0])
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => handleSaveField('next_due_date')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveField('next_due_date')
                  if (e.key === 'Escape') {
                    setTempNextDueDate(bill.next_due_date)
                    setEditingField(null)
                  }
                }}
                className="w-14 glass-small h-5 text-xs"
                placeholder="Day"
                autoFocus
              />
            ) : tempMultiplierType === 'one_off' ? (
              <Input
                type="date"
                value={tempNextDueDate}
                onChange={(e) => setTempNextDueDate(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => handleSaveField('next_due_date')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveField('next_due_date')
                  if (e.key === 'Escape') {
                    setTempNextDueDate(bill.next_due_date)
                    setEditingField(null)
                  }
                }}
                className="w-24 glass-small h-5 text-xs"
                autoFocus
              />
            ) : (
              <Input
                type="date"
                value={tempNextDueDate}
                onChange={(e) => setTempNextDueDate(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => handleSaveField('next_due_date')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveField('next_due_date')
                  if (e.key === 'Escape') {
                    setTempNextDueDate(bill.next_due_date)
                    setEditingField(null)
                  }
                }}
                className="w-24 glass-small h-5 text-xs"
                autoFocus
              />
            )}
          </div>
        ) : (
          <span 
            className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded"
            onClick={() => setEditingField('next_due_date')}
            title={tempMultiplierType === 'monthly' ? 'Click to edit day of month (1-31)' : tempMultiplierType === 'one_off' ? 'Click to edit payment date' : 'Click to edit next due date'}
          >
            {tempMultiplierType === 'monthly' 
              ? (bill.next_due_date ? `${new Date(bill.next_due_date).getDate()}` : '—')
              : nextDueDisplay}
          </span>
        )}
      </td>
      
      {/* Company Name - Editable */}
      <td className="py-1 px-1.5">
        {editingField === 'company_name' ? (
          <Input
            value={tempCompanyName}
            onChange={(e) => setTempCompanyName(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => handleSaveField('company_name')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveField('company_name')
              if (e.key === 'Escape') {
                setTempCompanyName(bill.company_name)
                setEditingField(null)
              }
            }}
            className="w-full glass-small h-5 text-xs"
            autoFocus
          />
        ) : (
          <span 
            className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded"
            onClick={() => setEditingField('company_name')}
            title="Click to edit"
          >
            {bill.company_name}
          </span>
        )}
      </td>
      
      {/* Amount Charged - Editable */}
      <td className="py-1 px-1.5 text-right">
        {editingField === 'amount' ? (
          <Input
            type="number"
            step="0.01"
            value={tempAmount}
            onChange={(e) => setTempAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => handleSaveField('amount')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveField('amount')
              if (e.key === 'Escape') {
                setTempAmount(bill.amount.toString())
                setEditingField(null)
              }
            }}
            className="w-18 glass-small h-5 text-xs text-right"
            autoFocus
          />
        ) : (
          <span 
            className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
            onClick={() => setEditingField('amount')}
            title="Click to edit"
          >
            {formatCurrency(bill.amount)}
          </span>
        )}
      </td>
      
      {/* Typical Amount - Editable */}
      <td className="py-1 px-1.5 text-right">
        {editingField === 'typical_amount' ? (
          <Input
            type="number"
            step="0.01"
            value={tempTypicalAmount}
            onChange={(e) => setTempTypicalAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => handleSaveField('typical_amount')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveField('typical_amount')
              if (e.key === 'Escape') {
                setTempTypicalAmount(bill.typical_amount?.toString() || '')
                setEditingField(null)
              }
            }}
            className="w-18 glass-small h-5 text-xs text-right"
            autoFocus
          />
        ) : (
          <span 
            className="glass-text-secondary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
            onClick={() => setEditingField('typical_amount')}
            title="Click to edit (reference only, not used in calculations)"
          >
            {bill.typical_amount ? formatCurrency(bill.typical_amount) : '—'}
          </span>
        )}
      </td>
      
      {/* Charge Cycle - Editable Dropdown */}
      <td className="py-1 px-1.5">
        {editingField === 'charge_cycle' ? (
          <Select
            value={tempChargeCycle}
            onValueChange={(value) => {
              setTempChargeCycle(value as FinanceBill['charge_cycle'])
              onUpdate(bill.id, { charge_cycle: value as FinanceBill['charge_cycle'] })
              setEditingField(null)
            }}
            onOpenChange={(open) => {
              if (!open && editingField === 'charge_cycle') {
                setEditingField(null)
              }
            }}
          >
            <SelectTrigger className="w-24 glass-small h-5 text-xs" autoFocus>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="bimonthly">Bi-monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semiannual">Semi-annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span 
            className="glass-text-secondary text-xs capitalize cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
            onClick={() => setEditingField('charge_cycle')}
            title="Click to edit"
          >
            {bill.charge_cycle}
          </span>
        )}
      </td>
      
      {/* Multiplier Type - Editable Dropdown */}
      <td className="py-1 px-1.5">
        {editingField === 'multiplier_type' ? (
          <Select
            value={tempMultiplierType}
            onValueChange={(value) => {
              const newType = value as 'monthly' | 'weekly' | 'one_off'
              setTempMultiplierType(newType)
              onUpdate(bill.id, { multiplier_type: newType })
              setEditingField(null)
            }}
            onOpenChange={(open) => {
              if (!open && editingField === 'multiplier_type') {
                setEditingField(null)
              }
            }}
          >
            <SelectTrigger className="w-20 glass-small h-5 text-xs" autoFocus>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="one_off">One off</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span 
            className="glass-text-secondary text-xs capitalize cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
            onClick={() => setEditingField('multiplier_type')}
            title="Click to edit"
          >
            {bill.multiplier_type || 'monthly'}
          </span>
        )}
      </td>
      
      {/* Payment Day - Editable (only for weekly multiplier) */}
      <td className="py-1 px-1.5">
        {tempMultiplierType === 'weekly' ? (
          editingField === 'payment_day' ? (
            <Select
              value={tempPaymentDay}
              onValueChange={(value) => {
                setTempPaymentDay(value)
                onUpdate(bill.id, { payment_day: parseInt(value) })
                setEditingField(null)
              }}
              onOpenChange={(open) => {
                if (!open && editingField === 'payment_day') {
                  setEditingField(null)
                }
              }}
            >
              <SelectTrigger className="w-18 glass-small h-5 text-xs" autoFocus>
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span 
              className="glass-text-secondary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
              onClick={() => setEditingField('payment_day')}
              title="Click to edit"
            >
              {bill.payment_day !== null && bill.payment_day !== undefined 
                ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][bill.payment_day]
                : '—'}
            </span>
          )
        ) : (
          <span className="glass-text-tertiary text-xs">—</span>
        )}
      </td>
      
      {/* Weeks Remaining - Read-only (calculated for weekly) */}
      <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
        {billWithRemaining.weeksRemaining !== null ? billWithRemaining.weeksRemaining : '—'}
      </td>
      
      {/* Total Weekly Cost - Read-only (calculated) */}
      <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
        {formatCurrency(billWithRemaining.totalWeeklyCost)}
      </td>
      
      {/* Total Monthly Cost - Read-only (calculated) */}
      <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
        {formatCurrency(billWithRemaining.totalMonthlyCost)}
      </td>
      
      {/* Remaining This Month - Read-only (calculated) */}
      <td className={`py-1 px-1.5 text-right font-medium text-xs ${billWithRemaining.remainingThisMonth > 0 ? 'text-red-500' : 'glass-text-secondary'}`}>
        {formatCurrency(billWithRemaining.remainingThisMonth)}
      </td>
      
      {/* Billing Account - Editable Dropdown */}
      <td className="py-1 px-1.5">
        {editingField === 'billing_account_id' ? (
          <Select
            value={tempBillingAccountId || '__none__'}
            onValueChange={(value) => {
              const accountId = value === '__none__' ? null : value
              setTempBillingAccountId(accountId || '')
              onUpdate(bill.id, { billing_account_id: accountId })
              setEditingField(null)
            }}
            onOpenChange={(open) => {
              if (!open && editingField === 'billing_account_id') {
                setEditingField(null)
              }
            }}
          >
            <SelectTrigger className="w-28 glass-small h-5 text-xs" autoFocus>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span 
            className="glass-text-secondary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
            onClick={() => setEditingField('billing_account_id')}
            title="Click to edit"
          >
            {accountName || '—'}
          </span>
        )}
      </td>
      
      {/* Paid - Partial Payment Selector */}
      <td className="py-1 px-1.5 text-center">
        {totalPayments > 1 ? (
          <Select
            value={paymentsPaid.toString()}
            onValueChange={handlePaymentsPaidChange}
          >
            <SelectTrigger className="w-20 glass-small h-5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalPayments + 1 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i} of {totalPayments}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Checkbox
            checked={paymentsPaid >= totalPayments}
            onCheckedChange={(checked) => onUpdatePaymentsPaid(bill.id, checked ? totalPayments : 0, totalPayments)}
            className="glass-small w-3.5 h-3.5"
          />
        )}
      </td>
      
      {/* Edit Button */}
      <td className="py-1 px-1.5 text-center">
        <Button
          variant="ghost"
          size="sm"
          className="glass-small h-5 w-5 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(fullBill)
          }}
          title="Edit bill"
        >
          ✎
        </Button>
      </td>
      
      {/* Delete Button */}
      <td className="py-1 px-1.5 text-center">
        <Button
          variant="ghost"
          size="sm"
          className="glass-small h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(bill.id)
          }}
          title="Delete bill"
        >
          ×
        </Button>
      </td>
    </tr>
  )
})
BillRow.displayName = 'BillRow'

// Projection Row Component
const ProjectionRow = memo(({
  projection,
  accounts,
  columnOrder,
  rowIndex,
  allProjections,
  onUpdate,
  onDelete,
}: {
  projection: FinanceProjection
  accounts: FinanceAccount[]
  columnOrder: string[]
  rowIndex: number
  allProjections: FinanceProjection[]
  onUpdate: (id: string, updates: Partial<FinanceProjection>) => void
  onDelete: (id: string) => void
}) => {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempAccountBalances, setTempAccountBalances] = useState<Record<string, string>>({})
  const [tempBillsRemaining, setTempBillsRemaining] = useState(projection.bills_remaining.toString())
  const [tempDaysRemaining, setTempDaysRemaining] = useState(projection.days_remaining.toString())
  const [tempNotes, setTempNotes] = useState(projection.notes || '')
  const isNavigating = useRef(false)

  // Initialize temp values - use stable dependencies to avoid infinite loops
  const projectionId = projection.id
  const projectionBillsRemaining = projection.bills_remaining
  const projectionDaysRemaining = projection.days_remaining
  const projectionNotes = projection.notes || ''
  const projectionAccountBalancesStr = useMemo(() => JSON.stringify(projection.account_balances), [projection.account_balances])
  const accountIdsStr = useMemo(() => accounts.map(a => a.id).sort().join(','), [accounts])
  
  useEffect(() => {
    const balances: Record<string, string> = {}
    for (const account of accounts) {
      balances[account.id] = (projection.account_balances[account.id] || 0).toString()
    }
    setTempAccountBalances(balances)
    setTempBillsRemaining(projection.bills_remaining.toString())
    setTempDaysRemaining(projection.days_remaining.toString())
    setTempNotes(projection.notes || '')
    // Using stringified versions (projectionAccountBalancesStr, accountIdsStr) to detect changes
    // accounts and projection.account_balances are used in effect body but changes are detected via stringified versions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionId, projectionBillsRemaining, projectionDaysRemaining, projectionNotes, projectionAccountBalancesStr, accountIdsStr, editingField])

  // Calculate totals and derived values
  const total = useMemo(() => {
    return accounts.reduce((sum, account) => {
      return sum + (projection.account_balances[account.id] || 0)
    }, 0)
  }, [accounts, projection.account_balances])

  const cashAvailable = useMemo(() => {
    return total - projection.bills_remaining
  }, [total, projection.bills_remaining])

  const weeksRemaining = useMemo(() => {
    return projection.days_remaining > 0 ? projection.days_remaining / 7 : 0
  }, [projection.days_remaining])

  const cashPerWeek = useMemo(() => {
    return weeksRemaining > 0 ? cashAvailable / weeksRemaining : 0
  }, [cashAvailable, weeksRemaining])

  const leftOver450PerWeek = useMemo(() => {
    const weeklySpend = 450 * weeksRemaining
    return cashAvailable - weeklySpend
  }, [cashAvailable, weeksRemaining])

  const minAmountNeeded = useMemo(() => {
    const weeklySpend = 450 * weeksRemaining
    return projection.bills_remaining + weeklySpend
  }, [projection.bills_remaining, weeksRemaining])

  const spendingPerDay = useMemo(() => {
    return projection.days_remaining > 0 ? cashAvailable / projection.days_remaining : 0
  }, [cashAvailable, projection.days_remaining])

  // Update account balance
  const handleAccountBalanceChange = useCallback((accountId: string, value: string) => {
    setTempAccountBalances(prev => ({ ...prev, [accountId]: value }))
    const numValue = parseFloat(value) || 0
    const newBalances = { ...projection.account_balances, [accountId]: numValue }
    const newTotal = Object.values(newBalances).reduce((sum, val) => sum + val, 0)
    const newCashAvailable = newTotal - projection.bills_remaining
    
    onUpdate(projection.id, {
      account_balances: newBalances,
      total_available: newTotal,
      cash_available: newCashAvailable,
      cash_per_week: weeksRemaining > 0 ? newCashAvailable / weeksRemaining : null,
      spending_per_day: projection.days_remaining > 0 ? newCashAvailable / projection.days_remaining : null,
    })
  }, [projection, weeksRemaining, onUpdate])

  // Update bills remaining
  const handleBillsRemainingChange = useCallback((value: string) => {
    setTempBillsRemaining(value)
    const numValue = parseFloat(value) || 0
    const newCashAvailable = total - numValue
    
    onUpdate(projection.id, {
      bills_remaining: numValue,
      cash_available: newCashAvailable,
      cash_per_week: weeksRemaining > 0 ? newCashAvailable / weeksRemaining : null,
      spending_per_day: projection.days_remaining > 0 ? newCashAvailable / projection.days_remaining : null,
    })
  }, [projection.id, total, weeksRemaining, projection.days_remaining, onUpdate])

  // Update days remaining
  const handleDaysRemainingChange = useCallback((value: string) => {
    setTempDaysRemaining(value)
    const numValue = parseInt(value) || 0
    const newDaysRemaining = Math.max(0, numValue)
    const newWeeksRemaining = newDaysRemaining > 0 ? newDaysRemaining / 7 : 0
    
    // Recalculate cash_per_week and spending_per_day based on new days_remaining
    onUpdate(projection.id, {
      days_remaining: newDaysRemaining,
      cash_per_week: newWeeksRemaining > 0 ? cashAvailable / newWeeksRemaining : null,
      spending_per_day: newDaysRemaining > 0 ? cashAvailable / newDaysRemaining : null,
    })
  }, [projection.id, cashAvailable, onUpdate])

  // Update notes
  const handleNotesChange = useCallback((value: string) => {
    setTempNotes(value)
    onUpdate(projection.id, { notes: value || null })
  }, [projection.id, onUpdate])

  // Time field state
  const [tempTime, setTempTime] = useState(projection.entry_time || '')

  // Sync time when projection changes
  useEffect(() => {
    setTempTime(projection.entry_time || '')
  }, [projection.entry_time])

  // Handle time change
  const handleTimeChange = useCallback((value: string) => {
    // Format time as HH:MM:SS
    let timeValue = value
    if (timeValue.match(/^\d{1,2}:\d{2}$/)) {
      // If HH:MM format, add :00 seconds
      timeValue = `${timeValue}:00`
    } else if (timeValue.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      // Already in HH:MM:SS format
      timeValue = timeValue
    }
    setTempTime(timeValue)
    onUpdate(projection.id, { entry_time: timeValue || null })
  }, [projection.id, onUpdate])

  // Helper function to get editable column IDs in order
  const getEditableColumns = useCallback(() => {
    return columnOrder.filter(id => {
      return id === 'time' || 
             id === 'daysRemaining' || 
             id.startsWith('account_') || 
             id === 'billsRemaining' || 
             id === 'notes'
    })
  }, [columnOrder])

  // Helper function to map field name to column ID
  const getColumnIdFromField = useCallback((field: string): string | null => {
    if (field === 'entry_time') return 'time'
    if (field === 'days_remaining') return 'daysRemaining'
    if (field.startsWith('account_')) return field
    if (field === 'bills_remaining') return 'billsRemaining'
    if (field === 'notes') return 'notes'
    return null
  }, [])

  // Helper function to map column ID to field name
  const getFieldFromColumnId = useCallback((columnId: string): string | null => {
    if (columnId === 'time') return 'entry_time'
    if (columnId === 'daysRemaining') return 'days_remaining'
    if (columnId.startsWith('account_')) return columnId
    if (columnId === 'billsRemaining') return 'bills_remaining'
    if (columnId === 'notes') return 'notes'
    return null
  }, [])

  // Save current field value before navigating
  const saveCurrentField = useCallback((field: string) => {
    if (field === 'entry_time') {
      handleTimeChange(tempTime)
    } else if (field === 'days_remaining') {
      handleDaysRemainingChange(tempDaysRemaining)
    } else if (field.startsWith('account_')) {
      const accountId = field.replace('account_', '')
      handleAccountBalanceChange(accountId, tempAccountBalances[accountId] || '0')
    } else if (field === 'bills_remaining') {
      handleBillsRemainingChange(tempBillsRemaining)
    } else if (field === 'notes') {
      handleNotesChange(tempNotes)
    }
  }, [tempTime, tempDaysRemaining, tempAccountBalances, tempBillsRemaining, tempNotes, handleTimeChange, handleDaysRemainingChange, handleAccountBalanceChange, handleBillsRemainingChange, handleNotesChange])

  // Unified navigation function for all editable fields
  const navigateField = useCallback(async (direction: 'left' | 'right' | 'up' | 'down', currentField: string) => {
    if (!currentField) return

    // Save current value before navigating
    saveCurrentField(currentField)

    const editableColumns = getEditableColumns()
    const currentColumnId = getColumnIdFromField(currentField)
    if (!currentColumnId) return

    const currentColumnIndex = editableColumns.indexOf(currentColumnId)
    if (currentColumnIndex === -1) return

    if (direction === 'left' || direction === 'right') {
      // Navigate within the same row
      let targetColumnIndex: number
      if (direction === 'right') {
        targetColumnIndex = currentColumnIndex + 1
        if (targetColumnIndex >= editableColumns.length) {
          targetColumnIndex = 0 // Wrap to first editable field
        }
      } else {
        targetColumnIndex = currentColumnIndex - 1
        if (targetColumnIndex < 0) {
          targetColumnIndex = editableColumns.length - 1 // Wrap to last editable field
        }
      }

      const targetColumnId = editableColumns[targetColumnIndex]
      const targetField = getFieldFromColumnId(targetColumnId)
      if (!targetField) return

      // Set target field immediately, then focus
      setEditingField(targetField)
      
      // Focus the input after state update
      setTimeout(() => {
        if (targetField.startsWith('account_')) {
          const accountId = targetField.replace('account_', '')
          const input = document.querySelector(`input[data-account-id="${accountId}"]`) as HTMLInputElement
          if (input) {
            input.focus()
            input.select()
          }
        } else {
          const input = document.querySelector(`input[data-field="${targetField}"]`) as HTMLInputElement
          if (input) {
            input.focus()
            input.select()
          }
        }
      }, 0)
    } else if (direction === 'up' || direction === 'down') {
      // Navigate to the same field in adjacent row
      let targetRowIndex: number
      if (direction === 'down') {
        targetRowIndex = rowIndex + 1
        if (targetRowIndex >= allProjections.length) {
          return // Can't go down from last row
        }
      } else {
        targetRowIndex = rowIndex - 1
        if (targetRowIndex < 0) {
          return // Can't go up from first row
        }
      }

      const targetProjection = allProjections[targetRowIndex]
      if (!targetProjection) return

      setEditingField(null) // Clear current editing
      
      // Navigate to the same field in the target row
      // Since each row has its own state, we need to trigger edit mode by clicking the span
      setTimeout(() => {
        const targetRow = document.querySelector(`tr[data-projection-id="${targetProjection.id}"]`)
        if (targetRow) {
          if (currentField.startsWith('account_')) {
            const accountId = currentField.replace('account_', '')
            // Try to find existing input first (if already in edit mode)
            let input = targetRow.querySelector(`input[data-account-id="${accountId}"]`) as HTMLInputElement
            if (input) {
              input.focus()
              input.select()
            } else {
              // Click the span to enter edit mode, then focus the input
              const span = targetRow.querySelector(`span[data-account-id="${accountId}"]`) as HTMLElement
              if (!span) {
                // Fallback: try clicking any element that might trigger edit mode
                const clickable = targetRow.querySelector(`td:has(span[onclick*="account_${accountId}"])`) as HTMLElement
                if (clickable) {
                  const spanInCell = clickable.querySelector('span') as HTMLElement
                  if (spanInCell) spanInCell.click()
                }
              } else {
                span.click()
              }
              // Wait for input to appear, then focus it
              setTimeout(() => {
                input = targetRow.querySelector(`input[data-account-id="${accountId}"]`) as HTMLInputElement
                if (input) {
                  input.focus()
                  input.select()
                }
              }, 50)
            }
          } else {
            // For non-account fields, click the span to enter edit mode
            const span = targetRow.querySelector(`span[data-field="${currentField}"]`) as HTMLElement
            if (span) {
              span.click()
              // Wait for input to appear, then focus it
              setTimeout(() => {
                const input = targetRow.querySelector(`input[data-field="${currentField}"]`) as HTMLInputElement
                if (input) {
                  input.focus()
                  input.select()
                }
              }, 50)
            }
          }
        }
      }, 0)
    }
  }, [rowIndex, allProjections, getEditableColumns, getColumnIdFromField, getFieldFromColumnId, saveCurrentField])


  // Render cells based on column order
  const renderCell = (columnId: string) => {
    // Time column
    if (columnId === 'time') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-center">
          {editingField === 'entry_time' ? (
            <Input
              type="time"
              step="1"
              value={tempTime || ''}
              data-field="entry_time"
              onChange={(e) => setTempTime(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleTimeChange(tempTime)
                setEditingField(null)
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  handleTimeChange(tempTime)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempTime(projection.entry_time || '')
                  setEditingField(null)
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowRight' ? 'right' : 'left', 'entry_time')
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowDown' ? 'down' : 'up', 'entry_time')
                }
              }}
              className="w-20 glass-small h-5 text-xs text-center"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
              data-field="entry_time"
              onClick={() => setEditingField('entry_time')}
              title="Click to edit"
            >
              {projection.entry_time ? projection.entry_time.substring(0, 5) : '—'}
            </span>
          )}
        </td>
      )
    }
    
    // Days Remaining column - Editable
    if (columnId === 'daysRemaining') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-center">
          {editingField === 'days_remaining' ? (
            <Input
              type="number"
              min="0"
              step="1"
              value={tempDaysRemaining}
              data-field="days_remaining"
              onChange={(e) => setTempDaysRemaining(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                // Don't blur if we're navigating to another field
                if (isNavigating.current) {
                  isNavigating.current = false
                  return
                }
                handleDaysRemainingChange(tempDaysRemaining)
                setEditingField(null)
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleDaysRemainingChange(tempDaysRemaining)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempDaysRemaining(projection.days_remaining.toString())
                  setEditingField(null)
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  e.stopPropagation()
                  isNavigating.current = true
                  // Save current value before navigating
                  handleDaysRemainingChange(tempDaysRemaining)
                  await navigateField(e.key === 'ArrowRight' ? 'right' : 'left', 'days_remaining')
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  e.stopPropagation()
                  isNavigating.current = true
                  // Save current value before navigating
                  handleDaysRemainingChange(tempDaysRemaining)
                  await navigateField(e.key === 'ArrowDown' ? 'down' : 'up', 'days_remaining')
                }
              }}
              className="w-16 glass-small h-5 text-xs text-center"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
              data-field="days_remaining"
              onClick={() => setEditingField('days_remaining')}
              title="Click to edit"
            >
              {projection.days_remaining}
            </span>
          )}
        </td>
      )
    }
    
    // Account columns
    if (columnId.startsWith('account_')) {
      const accountId = columnId.replace('account_', '')
      const account = accounts.find(a => a.id === accountId)
      if (!account) return null
      return (
        <td key={columnId} className="py-1 px-1.5 text-right">
          {editingField === `account_${account.id}` ? (
            <Input
              type="number"
              step="0.01"
              value={tempAccountBalances[account.id] || '0'}
              data-account-id={account.id}
              onChange={(e) => {
                setTempAccountBalances(prev => ({ ...prev, [account.id]: e.target.value }))
              }}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleAccountBalanceChange(account.id, tempAccountBalances[account.id] || '0')
                setEditingField(null)
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  handleAccountBalanceChange(account.id, tempAccountBalances[account.id] || '0')
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempAccountBalances(prev => ({ 
                    ...prev, 
                    [account.id]: (projection.account_balances[account.id] || 0).toString() 
                  }))
                  setEditingField(null)
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowRight' ? 'right' : 'left', `account_${account.id}`)
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowDown' ? 'down' : 'up', `account_${account.id}`)
                }
              }}
              className="w-20 glass-small h-5 text-xs text-right"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
              data-account-id={account.id}
              onClick={() => setEditingField(`account_${account.id}`)}
              title="Click to edit"
            >
              {formatCurrency(projection.account_balances[account.id] || 0)}
            </span>
          )}
        </td>
      )
    }
    
    // Total column
    if (columnId === 'total') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/5">
          {formatCurrency(total)}
        </td>
      )
    }
    
    // Bills Remaining column
    if (columnId === 'billsRemaining') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right bg-white/5">
          {editingField === 'bills_remaining' ? (
            <Input
              type="number"
              step="0.01"
              value={tempBillsRemaining}
              data-field="bills_remaining"
              onChange={(e) => setTempBillsRemaining(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleBillsRemainingChange(tempBillsRemaining)
                setEditingField(null)
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  handleBillsRemainingChange(tempBillsRemaining)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempBillsRemaining(projection.bills_remaining.toString())
                  setEditingField(null)
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowRight' ? 'right' : 'left', 'bills_remaining')
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowDown' ? 'down' : 'up', 'bills_remaining')
                }
              }}
              className="w-24 glass-small h-5 text-xs text-right"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block font-semibold"
              data-field="bills_remaining"
              onClick={() => setEditingField('bills_remaining')}
              title="Click to edit"
            >
              {formatCurrency(projection.bills_remaining)}
            </span>
          )}
        </td>
      )
    }
    
    // Cash Available column
    if (columnId === 'cashAvailable') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/5">
          {formatCurrency(cashAvailable)}
        </td>
      )
    }
    
    // Cash per week column
    if (columnId === 'cashPerWeek') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-secondary text-xs bg-white/5">
          {formatCurrency(cashPerWeek)}
        </td>
      )
    }
    
    // Left Over if only spend 450 per week column
    if (columnId === 'leftOver450') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-secondary text-xs">
          {formatCurrency(leftOver450PerWeek)}
        </td>
      )
    }
    
    // Min amount needed column
    if (columnId === 'minAmountNeeded') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-secondary text-xs">
          {formatCurrency(minAmountNeeded)}
        </td>
      )
    }
    
    // Spending available per day column
    if (columnId === 'spendingPerDay') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-right glass-text-secondary text-xs">
          {formatCurrency(spendingPerDay)}
        </td>
      )
    }
    
    // Notes column
    if (columnId === 'notes') {
      return (
        <td key={columnId} className="py-1 px-1.5">
          {editingField === 'notes' ? (
            <Input
              value={tempNotes}
              data-field="notes"
              onChange={(e) => setTempNotes(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleNotesChange(tempNotes)
                setEditingField(null)
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  handleNotesChange(tempNotes)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempNotes(projection.notes || '')
                  setEditingField(null)
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowRight' ? 'right' : 'left', 'notes')
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  await navigateField(e.key === 'ArrowDown' ? 'down' : 'up', 'notes')
                }
              }}
              className="w-full glass-small h-5 text-xs"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-secondary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block truncate max-w-[100px]"
              data-field="notes"
              onClick={() => setEditingField('notes')}
              title="Click to edit"
            >
              {projection.notes || '—'}
            </span>
          )}
        </td>
      )
    }
    
    // Delete column
    if (columnId === 'delete') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="glass-small h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(projection.id)
            }}
            title="Delete row"
          >
            ×
          </Button>
        </td>
      )
    }
    
    return null
  }

  return (
    <tr 
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
      data-projection-id={projection.id}
    >
      {columnOrder.map(columnId => renderCell(columnId))}
    </tr>
  )
})
ProjectionRow.displayName = 'ProjectionRow'

