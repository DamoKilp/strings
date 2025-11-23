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
  type FinanceAccount,
  type FinanceBill,
  type MonthlySnapshot,
  type FinanceProjection,
} from '@/app/actions/finance'
import {
  calculateBillsBreakdown,
  calculateTotalBillsRemaining,
  calculateCashFlowProjection,
  getDaysRemainingInMonth,
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
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<FinanceAccount[]>(initialAccounts)
  const [bills, setBills] = useState<FinanceBill[]>(initialBills)
  const [billPaymentsPaid, setBillPaymentsPaid] = useState<Record<string, number>>(initialBillPaymentsPaid)
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear())
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>(initialSnapshots)
  const [isPending, startTransition] = useTransition()
  
  // Dialog states
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false)
  const [isAddBillDialogOpen, setIsAddBillDialogOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingNextPeriod, setIsCreatingNextPeriod] = useState(false)
  const [activeTab, setActiveTab] = useState('current')
  const [allHistoricalProjections, setAllHistoricalProjections] = useState<FinanceProjection[]>([])
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false)
  
  // Bills Breakdown table sorting state
  const [billsSortColumn, setBillsSortColumn] = useState<string | null>(null)
  const [billsSortDirection, setBillsSortDirection] = useState<'asc' | 'desc'>('asc')
  
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
      const [accountsRes, billsRes, snapshotsRes, projectionsRes] = await Promise.all([
        getAccounts(),
        getBills(),
        getMonthlySnapshots(),
        getProjections(selectedMonthYear),
      ])

      if (accountsRes.data) setAccounts(accountsRes.data)
      if (billsRes.data) setBills(billsRes.data)
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
  const initialAccountsStr = useMemo(() => JSON.stringify(initialAccounts), [initialAccounts])
  const initialBillsStr = useMemo(() => JSON.stringify(initialBills), [initialBills])
  const initialProjectionsStr = useMemo(() => JSON.stringify(initialProjections), [initialProjections])
  const initialSnapshotsStr = useMemo(() => JSON.stringify(initialSnapshots), [initialSnapshots])
  const initialBillPaymentsPaidStr = useMemo(() => JSON.stringify(initialBillPaymentsPaid), [initialBillPaymentsPaid])
  
  // Track if we've made client-side modifications to prevent overwriting with stale server data
  const hasClientModifications = useRef(false)
  
  useEffect(() => {
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
  }, [initialAccountsStr, initialBillsStr, initialProjectionsStr, initialSnapshotsStr, initialBillPaymentsPaidStr, projections.length])

  // Calculate pay cycle days
  const payCycleDays = useMemo(() => {
    const start = new Date(payCycleStart)
    const end = new Date(payCycleEnd)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }, [payCycleStart, payCycleEnd])

  // Calculate days remaining in pay cycle
  const daysRemainingInCycle = useMemo(() => {
    const todayDate = new Date(today)
    const endDate = new Date(payCycleEnd)
    const diffTime = endDate.getTime() - todayDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }, [today, payCycleEnd])

  // Use pay cycle days remaining for projections instead of month days
  const daysRemaining = daysRemainingInCycle

  // Calculate bills breakdown with stable dependencies - using pay cycle dates
  const billsBreakdown = useMemo<BillWithRemaining[]>(() => {
    if (!bills.length) return []
    return calculateBillsBreakdown(bills, billPaymentsPaid, payCycleStart, payCycleEnd, daysRemaining)
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

  // Memoize totals (only recalculate when bills breakdown changes)
  const totalMonthlyBills = useMemo(() => {
    return billsBreakdown.reduce((sum, item) => sum + item.totalMonthlyCost, 0)
  }, [billsBreakdown])
  
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
  const projection = useMemo(() => {
    return calculateCashFlowProjection(
      accountBalances,
      billsRemaining,
      daysRemaining
    )
  }, [accountBalances, billsRemaining, daysRemaining])

  // Auto-save bill payment statuses to snapshot (debounced)
  const saveBillPaymentStatusesInDb = useCallback(async (currentBillPaymentsPaid: Record<string, number>) => {
    if (!user) return
    
    try {
      const monthYear = getCurrentMonthYear()
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
  }, [user, bills, billsBreakdown, accountBalances, projection])

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

  // Handle account balance change
  const handleBalanceChange = useCallback((accountId: string, newBalance: string) => {
    const numValue = parseFloat(newBalance) || 0
    optimisticallyUpdateBalance(accountId, numValue)
    debouncedUpdateBalance(accountId, numValue)
  }, [optimisticallyUpdateBalance, debouncedUpdateBalance])

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
  const handleCreateNextPeriod = useCallback(async () => {
    if (!user || isCreatingNextPeriod) return
    
    setIsCreatingNextPeriod(true)
    try {
      // First, save the current period
      const saved = await handleSaveSnapshot()
      if (!saved) {
        // If save failed, stop here
        return
      }

      // Wait a moment for the save to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reset to new period:
      // 1. Keep account balances as they are (already set)
      // 2. Reset all bills to unpaid (full monthly cost remaining)
      // 3. Reset selected month/year to current month
      startTransition(() => {
        setBillPaymentsPaid({}) // All bills unpaid
        setSelectedMonthYear(getCurrentMonthYear()) // Current month
        
        toast.success('Next billing period created', {
          description: 'All bills reset to unpaid with full monthly costs'
        })
      })
    } catch (err) {
      console.error('Failed to create next period:', err)
      toast.error('Failed to create next period')
    } finally {
      setIsCreatingNextPeriod(false)
    }
  }, [user, isCreatingNextPeriod, handleSaveSnapshot])

  // Load monthly snapshot
  const handleLoadSnapshot = useCallback(async (monthYear: string) => {
    if (!user) return
    
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
    setBillPaymentsPaid(paymentsPaid)
    
    toast.success('Snapshot loaded', {
      description: `Restored ${monthYear} snapshot`
    })
  }, [user, accounts, optimisticallyUpdateBalance, debouncedUpdateBalance])

  // Add new projection row
  const handleAddProjectionRow = useCallback(() => {
    if (!user) return
    
    const todayDate = new Date(today)
    todayDate.setHours(0, 0, 0, 0)
    const endDate = new Date(payCycleEnd)
    endDate.setHours(0, 0, 0, 0)
    const diffTime = endDate.getTime() - todayDate.getTime()
    const daysRem = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const accountBalances: Record<string, number> = {}
    // Initialize account balances to 0
    for (const account of accounts) {
      accountBalances[account.id] = 0
    }
    
    // Calculate current bills remaining from bills breakdown (sum of all "Remaining This month")
    const currentBillsRemaining = billsBreakdown.reduce((sum, item) => sum + item.remainingThisMonth, 0)
    
    // Generate unique time for this entry (current time, or increment if multiple entries today)
    const now = new Date()
    const existingToday = projections.filter(p => p.projection_date === today && p.days_remaining === Math.max(0, daysRem))
    // Find the highest seconds value used for this date/days combination to ensure uniqueness
    let maxSeconds = now.getSeconds()
    existingToday.forEach(p => {
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
    
    const newProjection: Partial<FinanceProjection> & {
      projection_date: string
      days_remaining: number
      account_balances: Record<string, number>
      total_available: number
      bills_remaining: number
      cash_available: number
    } = {
      projection_date: today,
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
        p.projection_date === today && 
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
        
        toast.success(isUpdate ? 'Row updated' : 'Row added')
      } else {
        toast.error('Failed to add row', { description: res.error || 'Unknown error' })
      }
    })
  }, [user, accounts, today, payCycleEnd, projections, billsBreakdown, allHistoricalProjections.length])

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
      toast.error('Failed to update projection', { description: res.error })
      // Reload projections on error
      const projectionsRes = await getProjections(selectedMonthYear)
      if (projectionsRes.data) {
        setProjections(projectionsRes.data)
        hasClientModifications.current = false
      }
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
  }, [projections, selectedMonthYear, allHistoricalProjections.length])

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Please sign in to access your finances</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="text-center">
          <p className="glass-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-0 md:ml-[var(--outer-rail-width,64px)] px-2 sm:px-4 md:px-8 py-4 md:py-6 min-h-[100dvh] flex flex-col overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Personal Finance Header */}
        <div className="mb-2 flex-shrink-0">
          <h1 className="glass-text-primary text-lg font-semibold">
            Personal Finance - {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h1>
        </div>

        {/* Tabs Navigation - Specification-compliant structure */}
        <TabsGlass value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          {/* Tabs Header - Positioned at top with minimal padding (compact design) */}
          <div 
            className="glass-medium glass-legible p-1 mb-2 relative overflow-hidden flex-shrink-0"
            style={{ borderRadius: '9999px' }}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-br from-purple-500/12 via-slate-900/60 to-indigo-500/12"
              style={{ borderRadius: '9999px' }}
            />
            
            <div className="relative z-10 flex items-center justify-center gap-2 w-full">
              <TabsListGlass>
                <TabsTriggerGlass value="current">Current View</TabsTriggerGlass>
                <TabsTriggerGlass value="historical">Historical Spend Tracking</TabsTriggerGlass>
                <TabsTriggerGlass value="charts">Chart Analysis</TabsTriggerGlass>
                <TabsTriggerGlass value="periods">Billing Periods</TabsTriggerGlass>
              </TabsListGlass>
            </div>
          </div>

          {/* Tab Contents - Full height, no top margin */}
          <div className="flex-1 min-h-0 min-w-0 relative">
            {/* Current View Tab */}
            <TabsContentGlass value="current" className="h-full">

        {/* Pay Cycle Header - Compact single row */}
        <Card className="glass-large mb-2">
          <CardContent className="py-1">
            <div className="flex flex-wrap items-end gap-x-1.5 gap-y-0.5">
              <div className="flex items-center gap-0.5">
                <Label htmlFor="today-date" className="glass-text-secondary text-xs whitespace-nowrap">Today&apos;s Date:</Label>
                <Input
                  id="today-date"
                  type="date"
                  value={today}
                  readOnly
                  className="w-32 glass-small h-5 text-xs py-0"
                />
              </div>
              
              <div className="flex items-center gap-0.5">
                <Label htmlFor="pay-start" className="glass-text-secondary text-xs whitespace-nowrap">Pay Cycle Start:</Label>
                <Input
                  id="pay-start"
                  type="date"
                  value={payCycleStart}
                  onChange={(e) => setPayCycleStart(e.target.value)}
                  className="w-32 glass-small h-5 text-xs py-0"
                />
              </div>
              
              <div className="flex items-center gap-0.5">
                <Label htmlFor="pay-end" className="glass-text-secondary text-xs whitespace-nowrap">Pay Cycle End:</Label>
                <Input
                  id="pay-end"
                  type="date"
                  value={payCycleEnd}
                  onChange={(e) => setPayCycleEnd(e.target.value)}
                  className="w-32 glass-small h-5 text-xs py-0"
                />
              </div>
              
              <div className="glass-small px-1.5 py-0 h-5 rounded flex items-center">
                <span className="glass-text-secondary text-xs whitespace-nowrap">Days this cycle:</span>
                <span className="glass-text-primary text-xs font-semibold ml-0.5">{payCycleDays}</span>
              </div>
              
              <div className="glass-small px-1.5 py-0 h-5 rounded flex items-center">
                <span className="glass-text-secondary text-xs whitespace-nowrap">Days remaining:</span>
                <span className="glass-text-primary text-xs font-semibold ml-0.5">{daysRemaining}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Balance Requirements + Date in single row */}
        <Card className="glass-large mb-2">
          <CardContent className="py-1">
            <div className="flex flex-wrap items-end justify-between gap-x-1.5 gap-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="glass-text-secondary text-xs font-medium">Account Balance Requirements:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-small text-xs h-6"
                  onClick={() => setIsAddAccountDialogOpen(true)}
                >
                  + Add Account
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 items-center">
                {accounts.map(account => {
                  const required = accountRequirements[account.id] || 0
                  // Only show accounts with requirements > 0
                  if (required <= 0) return null
                  return (
                    <div key={account.id} className="flex items-center gap-0.5">
                      <span className="glass-text-primary text-xs truncate max-w-[70px]">{account.name}:</span>
                      <span className="glass-text-primary text-xs font-semibold whitespace-nowrap text-red-500">
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

        {/* Cash Flow Summary - Single row, compact */}
        <Card className="glass-large mb-2">
          <CardContent className="py-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <div className="flex items-center gap-0.5">
                <span className="glass-text-secondary text-xs">Total Available:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.totalAvailable)}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="glass-text-secondary text-xs">Bills Remaining:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.billsRemaining)}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="glass-text-secondary text-xs">Cash Available:</span>
                <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.cashAvailable)}</span>
              </div>
              {projection.cashPerWeek !== null && (
                <div className="flex items-center gap-0.5">
                  <span className="glass-text-secondary text-xs">Cash per Week:</span>
                  <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.cashPerWeek)}</span>
                </div>
              )}
              {projection.spendingPerDay !== null && (
                <div className="flex items-center gap-0.5">
                  <span className="glass-text-secondary text-xs">Spending per Day:</span>
                  <span className="glass-text-primary text-xs font-semibold">{formatCurrency(projection.spendingPerDay)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bills Breakdown Section */}
        <Card className="glass-large mb-2">
          <CardHeader className="py-1 flex flex-row items-center justify-between">
            <CardTitle className="glass-text-primary text-xs font-semibold">Bills Breakdown</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="glass-small text-xs h-6"
              onClick={() => {
                setEditingBill(null)
                setIsAddBillDialogOpen(true)
              }}
            >
              + Add Bill
            </Button>
          </CardHeader>
          <CardContent className="py-1">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
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
          </CardContent>
        </Card>

        {/* Spend Tracking Section */}
        <Card className="glass-large mb-2">
          <CardHeader className="py-1 flex flex-row items-center justify-between">
            <CardTitle className="glass-text-primary text-xs font-semibold">Spend Tracking</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="glass-small text-xs h-6"
              onClick={handleAddProjectionRow}
            >
              + Add Row
            </Button>
          </CardHeader>
          <CardContent className="py-1">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
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
                      billsRemaining={billsRemaining}
                      payCycleEnd={payCycleEnd}
                      columnOrder={spendTrackingColumnOrder}
                      onUpdate={handleUpdateProjection}
                      onDelete={handleDeleteProjection}
                    />
                  ))}
                </tbody>
              </table>
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
            value={selectedMonthYear}
            onValueChange={(value) => {
              setSelectedMonthYear(value)
              loadData()
            }}
          >
            <SelectTrigger className="w-40 glass-small text-xs h-6">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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

  // Sync local state when bill changes
  useEffect(() => {
    setTempCompanyName(bill.company_name)
    setTempAmount(bill.amount.toString())
    setTempTypicalAmount(bill.typical_amount?.toString() || '')
    setTempChargeCycle(bill.charge_cycle)
    setTempNextDueDate(bill.next_due_date)
    setTempBillingAccountId(bill.billing_account_id ?? '')
    setTempCategory(bill.category ?? '')
    setTempMultiplierType(bill.multiplier_type || 'monthly')
    setTempPaymentDay((bill.payment_day ?? '').toString())
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
  billsRemaining,
  payCycleEnd,
  columnOrder,
  onUpdate,
  onDelete,
}: {
  projection: FinanceProjection
  accounts: FinanceAccount[]
  billsRemaining: number
  payCycleEnd: string
  columnOrder: string[]
  onUpdate: (id: string, updates: Partial<FinanceProjection>) => void
  onDelete: (id: string) => void
}) => {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempAccountBalances, setTempAccountBalances] = useState<Record<string, string>>({})
  const [tempBillsRemaining, setTempBillsRemaining] = useState(projection.bills_remaining.toString())
  const [tempNotes, setTempNotes] = useState(projection.notes || '')

  // Initialize temp values - use stable dependencies to avoid infinite loops
  const projectionId = projection.id
  const projectionBillsRemaining = projection.bills_remaining
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
    setTempNotes(projection.notes || '')
    // Using stringified versions (projectionAccountBalancesStr, accountIdsStr) to detect changes
    // accounts and projection.account_balances are used in effect body but changes are detected via stringified versions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionId, projectionBillsRemaining, projectionNotes, projectionAccountBalancesStr, accountIdsStr])

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

  // Helper function to navigate to next/previous account
  const navigateToAccount = useCallback((direction: 'left' | 'right', currentAccountId: string) => {
    // Get all account columns in order
    const accountColumns = columnOrder.filter(id => id.startsWith('account_'))
    const currentIndex = accountColumns.findIndex(id => id === `account_${currentAccountId}`)
    
    if (currentIndex === -1 || accountColumns.length <= 1) return
    
    let targetIndex: number
    if (direction === 'right') {
      targetIndex = currentIndex + 1
      if (targetIndex >= accountColumns.length) {
        targetIndex = 0 // Wrap to first account
      }
    } else {
      targetIndex = currentIndex - 1
      if (targetIndex < 0) {
        targetIndex = accountColumns.length - 1 // Wrap to last account
      }
    }
    
    const targetColumnId = accountColumns[targetIndex]
    const targetAccountId = targetColumnId.replace('account_', '')
    
    // Save current value before navigating (only if it has changed)
    const currentValue = tempAccountBalances[currentAccountId] || '0'
    const originalValue = (projection.account_balances[currentAccountId] || 0).toString()
    if (currentValue !== originalValue) {
      handleAccountBalanceChange(currentAccountId, currentValue)
    }
    
    // Navigate to next account
    setEditingField(`account_${targetAccountId}`)
    
    // Focus the input after state update
    setTimeout(() => {
      const input = document.querySelector(`input[data-account-id="${targetAccountId}"]`) as HTMLInputElement
      if (input) {
        input.focus()
        input.select()
      }
    }, 0)
  }, [columnOrder, tempAccountBalances, projection.account_balances, handleAccountBalanceChange])

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
              onChange={(e) => setTempTime(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleTimeChange(tempTime)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTimeChange(tempTime)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempTime(projection.entry_time || '')
                  setEditingField(null)
                }
              }}
              className="w-20 glass-small h-5 text-xs text-center"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
              onClick={() => setEditingField('entry_time')}
              title="Click to edit"
            >
              {projection.entry_time ? projection.entry_time.substring(0, 5) : '—'}
            </span>
          )}
        </td>
      )
    }
    
    // Days Remaining column
    if (columnId === 'daysRemaining') {
      return (
        <td key={columnId} className="py-1 px-1.5 text-center glass-text-primary text-xs">
          {projection.days_remaining}
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
              onKeyDown={(e) => {
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
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  navigateToAccount('right', account.id)
                }
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  navigateToAccount('left', account.id)
                }
              }}
              className="w-20 glass-small h-5 text-xs text-right"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block"
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
              onChange={(e) => setTempBillsRemaining(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleBillsRemainingChange(tempBillsRemaining)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBillsRemainingChange(tempBillsRemaining)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempBillsRemaining(projection.bills_remaining.toString())
                  setEditingField(null)
                }
              }}
              className="w-24 glass-small h-5 text-xs text-right"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-primary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block font-semibold"
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
              onChange={(e) => setTempNotes(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                handleNotesChange(tempNotes)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNotesChange(tempNotes)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setTempNotes(projection.notes || '')
                  setEditingField(null)
                }
              }}
              className="w-full glass-small h-5 text-xs"
              autoFocus
            />
          ) : (
            <span 
              className="glass-text-secondary text-xs cursor-pointer hover:bg-white/10 px-0.5 py-0 rounded inline-block truncate max-w-[100px]"
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
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      {columnOrder.map(columnId => renderCell(columnId))}
    </tr>
  )
})
ProjectionRow.displayName = 'ProjectionRow'

