// Finance calculation utilities

export interface BillWithRemaining {
  bill: {
    id: string
    company_name: string
    amount: number
    charge_cycle: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
    next_due_date: string
    billing_account_id: string | null
    category: string | null
  }
  totalWeeklyCost: number
  totalMonthlyCost: number
  remainingThisMonth: number
  isPaid: boolean
}

export interface CashFlowProjection {
  daysRemaining: number
  accountBalances: Record<string, number>
  billsAmount: number
  totalAvailable: number
  billsRemaining: number
  cashAvailable: number
  cashPerWeek: number | null
  spendingPerDay: number | null
}

/**
 * Calculate weekly and monthly costs for a bill based on charge cycle
 */
export function calculateBillCosts(amount: number, chargeCycle: string): { weekly: number; monthly: number } {
  const cycleMultipliers: Record<string, number> = {
    weekly: 1,
    biweekly: 0.5,
    monthly: 0.230769, // 1/4.33 weeks per month (avg)
    bimonthly: 0.115385, // 1/8.67 weeks per month
    quarterly: 0.076923, // 1/13 weeks per month
    semiannual: 0.038462, // 1/26 weeks per month
    annual: 0.019231, // 1/52 weeks per month
    custom: 0,
  }

  const multiplier = cycleMultipliers[chargeCycle.toLowerCase()] || 0
  const weekly = amount * multiplier
  const monthly = weekly * 4.33 // Average weeks per month

  return { weekly, monthly }
}

/**
 * Calculate remaining amount for a bill in the current month
 */
export function calculateRemainingThisMonth(
  amount: number,
  chargeCycle: string,
  nextDueDate: string,
  currentDate: Date = new Date()
): number {
  const dueDate = new Date(nextDueDate)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  // If bill is due this month
  if (dueDate >= firstDayOfMonth && dueDate <= lastDayOfMonth) {
    return amount
  }

  // For bills that occur multiple times per month
  const { monthly } = calculateBillCosts(amount, chargeCycle)
  const cycleDays: Record<string, number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    bimonthly: 60,
    quarterly: 90,
    semiannual: 180,
    annual: 365,
  }

  const cycleDayCount = cycleDays[chargeCycle.toLowerCase()] || 30
  const daysInMonth = lastDayOfMonth.getDate()
  const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)))

  if (chargeCycle === 'weekly' && daysUntilDue <= daysInMonth) {
    const weeksRemaining = Math.ceil(daysUntilDue / 7)
    return amount * weeksRemaining
  }

  if (chargeCycle === 'biweekly' && daysUntilDue <= daysInMonth) {
    return amount
  }

  // For monthly+ cycles, if due this month, return full amount
  if (daysUntilDue <= daysInMonth) {
    return amount
  }

  return 0
}

/**
 * Calculate bills breakdown with remaining amounts
 */
export function calculateBillsBreakdown(
  bills: Array<{
    id: string
    company_name: string
    amount: number
    charge_cycle: string
    next_due_date: string
    billing_account_id: string | null
    category: string | null
  }>,
  paidBillIds: Set<string>,
  currentDate: Date = new Date()
): BillWithRemaining[] {
  return bills.map(bill => {
    const { weekly, monthly } = calculateBillCosts(bill.amount, bill.charge_cycle)
    const remaining = paidBillIds.has(bill.id)
      ? 0
      : calculateRemainingThisMonth(bill.amount, bill.charge_cycle, bill.next_due_date, currentDate)

    return {
      bill: {
        id: bill.id,
        company_name: bill.company_name,
        amount: bill.amount,
        charge_cycle: bill.charge_cycle as BillWithRemaining['bill']['charge_cycle'],
        next_due_date: bill.next_due_date,
        billing_account_id: bill.billing_account_id,
        category: bill.category,
      },
      totalWeeklyCost: weekly,
      totalMonthlyCost: monthly,
      remainingThisMonth: remaining,
      isPaid: paidBillIds.has(bill.id),
    }
  })
}

/**
 * Calculate total bills remaining this month
 */
export function calculateTotalBillsRemaining(
  bills: Array<{
    id: string
    amount: number
    charge_cycle: string
    next_due_date: string
  }>,
  paidBillIds: Set<string>,
  currentDate: Date = new Date()
): number {
  return bills
    .filter(bill => !paidBillIds.has(bill.id))
    .reduce((total, bill) => {
      return total + calculateRemainingThisMonth(bill.amount, bill.charge_cycle, bill.next_due_date, currentDate)
    }, 0)
}

/**
 * Calculate cash flow projection
 */
export function calculateCashFlowProjection(
  accountBalances: Record<string, number>,
  billsRemaining: number,
  daysRemaining: number
): CashFlowProjection {
  const totalAvailable = Object.values(accountBalances).reduce((sum, balance) => sum + balance, 0)
  const cashAvailable = totalAvailable - billsRemaining
  const cashPerWeek = daysRemaining > 0 ? cashAvailable / (daysRemaining / 7) : null
  const spendingPerDay = daysRemaining > 0 ? cashAvailable / daysRemaining : null

  return {
    daysRemaining,
    accountBalances,
    billsAmount: billsRemaining,
    totalAvailable,
    billsRemaining,
    cashAvailable,
    cashPerWeek: cashPerWeek ? Math.round(cashPerWeek * 100) / 100 : null,
    spendingPerDay: spendingPerDay ? Math.round(spendingPerDay * 100) / 100 : null,
  }
}

/**
 * Get days remaining in current month
 */
export function getDaysRemainingInMonth(currentDate: Date = new Date()): number {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const today = currentDate.getDate()
  const daysRemaining = lastDayOfMonth.getDate() - today + 1
  return Math.max(0, daysRemaining)
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get current month-year string (e.g., "2025-01")
 */
export function getCurrentMonthYear(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
