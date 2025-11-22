'use client'

import React, { useEffect, useMemo, useState, useCallback, useTransition, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAccounts,
  getBills,
  updateAccountBalance,
  saveMonthlySnapshot,
  getMonthlySnapshots,
  loadMonthlySnapshot,
  type FinanceAccount,
  type FinanceBill,
  type MonthlySnapshot,
} from '@/app/actions/finance'
import {
  calculateBillsBreakdown,
  calculateTotalBillsRemaining,
  calculateCashFlowProjection,
  getDaysRemainingInMonth,
  getCurrentMonthYear,
  formatCurrency,
  type BillWithRemaining,
} from '@/lib/financeUtils'
import { useAuth } from '@/app/hooks/useAuth'

// Debounce utility for balance updates
function useDebounce<T extends (...args: unknown[]) => void>(callback: T, delay: number): T {
  const timeoutRef = React.useRef<NodeJS.Timeout>()
  
  return React.useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay]) as T
}

export default function FinancePage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [bills, setBills] = useState<FinanceBill[]>([])
  const [paidBillIds, setPaidBillIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear())
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>([])
  const [isPending, startTransition] = useTransition()

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
      const [accountsRes, billsRes, snapshotsRes] = await Promise.all([
        getAccounts(),
        getBills(),
        getMonthlySnapshots(),
      ])

      if (accountsRes.data) setAccounts(accountsRes.data)
      if (billsRes.data) setBills(billsRes.data)
      if (snapshotsRes.data) {
        setMonthlySnapshots(snapshotsRes.data)
        const currentMonth = getCurrentMonthYear()
        const currentSnapshot = snapshotsRes.data.find(s => s.month_year === currentMonth)
        if (currentSnapshot) {
          setPaidBillIds(new Set(
            Object.keys(currentSnapshot.bill_statuses).filter(
              billId => currentSnapshot.bill_statuses[billId]?.paid
            )
          ))
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Memoize days remaining (only changes once per day)
  const daysRemaining = useMemo(() => getDaysRemainingInMonth(), [])

  // Calculate bills breakdown with stable dependencies
  const billsBreakdown = useMemo<BillWithRemaining[]>(() => {
    if (!bills.length) return []
    return calculateBillsBreakdown(bills, paidBillIds)
  }, [bills, paidBillIds])

  // Memoize totals (only recalculate when bills breakdown changes)
  const totalMonthlyBills = useMemo(() => {
    return billsBreakdown.reduce((sum, item) => sum + item.totalMonthlyCost, 0)
  }, [billsBreakdown])

  const billsRemaining = useMemo(() => {
    return calculateTotalBillsRemaining(bills, paidBillIds)
  }, [bills, paidBillIds])

  // Memoize account balances map
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    for (const account of accounts) {
      balances[account.id] = account.balance
    }
    return balances
  }, [accounts])

  // Memoize account lookup map for bill rows
  const accountsMap = useMemo(() => {
    const map = new Map<string, FinanceAccount>()
    for (const account of accounts) {
      map.set(account.id, account)
    }
    return map
  }, [accounts])

  // Memoize projection (only recalculate when dependencies change)
  const projection = useMemo(() => {
    return calculateCashFlowProjection(accountBalances, billsRemaining, daysRemaining)
  }, [accountBalances, billsRemaining, daysRemaining])

  // Optimistic balance update with debounced save
  const handleUpdateBalance = useCallback((accountId: string, newBalance: number) => {
    optimisticallyUpdateBalance(accountId, newBalance)
    debouncedUpdateBalance(accountId, newBalance)
  }, [optimisticallyUpdateBalance, debouncedUpdateBalance])

  // Optimistic bill paid toggle
  const handleToggleBillPaid = useCallback((billId: string, isPaid: boolean) => {
    startTransition(() => {
      setPaidBillIds(prev => {
        const newSet = new Set(prev)
        if (isPaid) {
          newSet.add(billId)
        } else {
          newSet.delete(billId)
        }
        return newSet
      })
    })
  }, [])

  // Save monthly snapshot
  const handleSaveSnapshot = useCallback(async () => {
    if (!user) return
    const monthYear = getCurrentMonthYear()
    const billStatuses: Record<string, { paid: boolean; paid_date: string | null }> = {}
    for (const bill of bills) {
      billStatuses[bill.id] = {
        paid: paidBillIds.has(bill.id),
        paid_date: paidBillIds.has(bill.id) ? new Date().toISOString().split('T')[0] : null,
      }
    }

    await saveMonthlySnapshot({
      month_year: monthYear,
      account_balances: accountBalances,
      bill_statuses: billStatuses,
      cash_flow_data: projection as unknown as Record<string, unknown>,
    })
    // Reload snapshots list only
    const snapshotsRes = await getMonthlySnapshots()
    if (snapshotsRes.data) setMonthlySnapshots(snapshotsRes.data)
  }, [user, bills, paidBillIds, accountBalances, projection])

  // Load monthly snapshot
  const handleLoadSnapshot = useCallback(async (monthYear: string) => {
    const res = await loadMonthlySnapshot(monthYear)
    if (res.data) {
      startTransition(() => {
        setSelectedMonthYear(monthYear)
        setPaidBillIds(new Set(
          Object.keys(res.data!.bill_statuses).filter(
            billId => res.data!.bill_statuses[billId]?.paid
          )
        ))
      })
    }
  }, [])

  // Memoize formatted date to avoid recalculation on every render
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [])

  if (isLoading) {
    return (
      <div className="ml-0 md:ml-[var(--outer-rail-width,64px)] px-4 md:px-6 py-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="glass-large p-8 text-center">
            <p className="glass-text-secondary">Loading finance data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-0 md:ml-[var(--outer-rail-width,64px)] px-4 md:px-6 py-4 md:py-6">
      <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold glass-text-primary mb-1">Personal Finance</h1>
          <p className="glass-text-secondary text-sm">
            {formattedDate} • {daysRemaining} days remaining
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonthYear} onValueChange={handleLoadSnapshot} disabled={isPending}>
            <SelectTrigger className="w-[140px] glass-small">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthlySnapshots.map(snapshot => (
                <SelectItem key={snapshot.month_year} value={snapshot.month_year}>
                  {new Date(snapshot.month_year + '-01').toLocaleDateString('en-AU', {
                    month: 'short',
                    year: 'numeric'
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveSnapshot} className="glass-small" disabled={isPending}>
            Save Snapshot
          </Button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Cash Flow Summary - Large Card */}
        <Card className="lg:col-span-2 glass-large">
          <CardHeader>
            <CardTitle className="glass-text-primary">Cash Flow Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowSummary projection={projection} />
          </CardContent>
        </Card>

        {/* Account Balances - Medium Card */}
        <Card className="glass-large">
          <CardHeader>
            <CardTitle className="glass-text-primary">Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map(account => (
              <AccountBalanceItem
                key={account.id}
                account={account}
                onUpdate={handleUpdateBalance}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full glass-small mt-2"
              onClick={() => {/* TODO: Add account dialog */}}
            >
              + Add Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bills Breakdown - Full Width */}
      <Card className="glass-large mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="glass-text-primary">Bills Breakdown</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <span className="glass-text-secondary">
                Total: {formatCurrency(totalMonthlyBills)}
              </span>
              <span className="glass-text-secondary">
                Remaining: {formatCurrency(billsRemaining)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 glass-text-secondary font-medium">Paid</th>
                  <th className="text-left py-2 px-3 glass-text-secondary font-medium">Company</th>
                  <th className="text-right py-2 px-3 glass-text-secondary font-medium">Amount</th>
                  <th className="text-left py-2 px-3 glass-text-secondary font-medium">Cycle</th>
                  <th className="text-right py-2 px-3 glass-text-secondary font-medium">Monthly</th>
                  <th className="text-right py-2 px-3 glass-text-secondary font-medium">Remaining</th>
                  <th className="text-left py-2 px-3 glass-text-secondary font-medium">Account</th>
                </tr>
              </thead>
              <tbody>
                {billsBreakdown.map((item) => (
                  <BillRow
                    key={item.bill.id}
                    billWithRemaining={item}
                    accountName={accountsMap.get(item.bill.billing_account_id ?? '')?.name}
                    onTogglePaid={handleToggleBillPaid}
                  />
                ))}
              </tbody>
            </table>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 glass-small"
              onClick={() => {/* TODO: Add bill dialog */}}
            >
              + Add Bill
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

// Memoized Cash Flow Summary Component
const CashFlowSummary = memo(({ projection }: { projection: ReturnType<typeof calculateCashFlowProjection> }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div>
      <p className="glass-text-tertiary text-xs mb-1">Total Available</p>
      <p className="text-2xl font-bold glass-text-primary">{formatCurrency(projection.totalAvailable)}</p>
    </div>
    <div>
      <p className="glass-text-tertiary text-xs mb-1">Bills Remaining</p>
      <p className="text-2xl font-bold text-red-500">{formatCurrency(projection.billsRemaining)}</p>
    </div>
    <div>
      <p className="glass-text-tertiary text-xs mb-1">Cash Available</p>
      <p className="text-2xl font-bold text-green-500">{formatCurrency(projection.cashAvailable)}</p>
    </div>
    <div>
      <p className="glass-text-tertiary text-xs mb-1">Spending/Day</p>
      <p className="text-2xl font-bold glass-text-primary">
        {projection.spendingPerDay ? formatCurrency(projection.spendingPerDay) : '—'}
      </p>
    </div>
    {projection.cashPerWeek && (
      <div className="col-span-2 md:col-span-4">
        <p className="glass-text-tertiary text-xs mb-1">Cash per Week</p>
        <p className="text-xl font-semibold glass-text-primary">{formatCurrency(projection.cashPerWeek)}</p>
      </div>
    )}
  </div>
))
CashFlowSummary.displayName = 'CashFlowSummary'

// Memoized Account Balance Item Component
const AccountBalanceItem = memo(({
  account,
  onUpdate,
}: {
  account: FinanceAccount
  onUpdate: (accountId: string, balance: number) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(account.balance.toString())

  // Reset value when account balance changes externally
  useEffect(() => {
    setValue(account.balance.toString())
  }, [account.balance])

  const handleSubmit = useCallback(() => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue !== account.balance) {
      onUpdate(account.id, numValue)
      setIsEditing(false)
    } else {
      setIsEditing(false)
    }
  }, [value, account.balance, account.id, onUpdate])

  const handleCancel = useCallback(() => {
    setValue(account.balance.toString())
    setIsEditing(false)
  }, [account.balance])

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="glass-text-primary text-sm font-medium truncate">{account.name}</p>
        <p className="glass-text-tertiary text-xs">{account.account_type}</p>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 h-8 glass-small"
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="glass-text-primary font-semibold">{formatCurrency(account.balance)}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 glass-small"
            onClick={() => setIsEditing(true)}
          >
            ✎
          </Button>
        </div>
      )}
    </div>
  )
})
AccountBalanceItem.displayName = 'AccountBalanceItem'

// Memoized Bill Row Component - optimized with account name prop
const BillRow = memo(({
  billWithRemaining,
  accountName,
  onTogglePaid,
}: {
  billWithRemaining: BillWithRemaining
  accountName?: string
  onTogglePaid: (billId: string, isPaid: boolean) => void
}) => {
  const bill = billWithRemaining.bill

  const handleToggle = useCallback((checked: boolean) => {
    onTogglePaid(bill.id, checked)
  }, [bill.id, onTogglePaid])

  return (
    <tr className={`border-b border-white/5 hover:bg-white/5 transition-colors ${billWithRemaining.isPaid ? 'opacity-50' : ''}`}>
      <td className="py-2 px-3">
        <Checkbox
          checked={billWithRemaining.isPaid}
          onCheckedChange={handleToggle}
          className="glass-small"
        />
      </td>
      <td className="py-2 px-3 glass-text-primary">{bill.company_name}</td>
      <td className="py-2 px-3 text-right glass-text-primary">{formatCurrency(bill.amount)}</td>
      <td className="py-2 px-3 glass-text-secondary capitalize">{bill.charge_cycle}</td>
      <td className="py-2 px-3 text-right glass-text-secondary">{formatCurrency(billWithRemaining.totalMonthlyCost)}</td>
      <td className={`py-2 px-3 text-right font-medium ${billWithRemaining.remainingThisMonth > 0 ? 'text-red-500' : 'glass-text-secondary'}`}>
        {formatCurrency(billWithRemaining.remainingThisMonth)}
      </td>
      <td className="py-2 px-3 glass-text-secondary text-xs">{accountName || '—'}</td>
    </tr>
  )
})
BillRow.displayName = 'BillRow'