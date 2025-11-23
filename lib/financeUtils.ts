// Finance calculation utilities

export interface BillWithRemaining {
  bill: {
    id: string
    company_name: string
    amount: number
    typical_amount: number | null
    charge_cycle: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
    next_due_date: string
    billing_account_id: string | null
    category: string | null
    multiplier_type: 'monthly' | 'weekly' | 'one_off' | null
    payment_day: number | null
  }
  totalWeeklyCost: number
  totalMonthlyCost: number
  remainingThisMonth: number
  weeksRemaining: number | null
  totalPayments: number // Total number of payments in this pay cycle
  paymentsPaid: number // Number of payments that have been made (0 = unpaid, totalPayments = fully paid)
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
    typical_amount?: number | null
    charge_cycle: string
    next_due_date: string
    billing_account_id: string | null
    category: string | null
    multiplier_type?: 'monthly' | 'weekly' | 'one_off' | null
    payment_day?: number | null
  }>,
  billPaymentsPaid: Record<string, number>, // Map of bill ID to number of payments made
  payCycleStart?: string,
  payCycleEnd?: string,
  daysRemaining?: number,
  currentDate: Date = new Date()
): BillWithRemaining[] {
  return bills.map(bill => {
    const { weekly, monthly } = calculateBillCosts(bill.amount, bill.charge_cycle)
    const multiplierType = bill.multiplier_type || 'monthly'
    
    let remaining = 0
    let weeksRemaining: number | null = null
    let totalPayments = 0
    const paymentsPaid = billPaymentsPaid[bill.id] || 0

    // Calculate total payments in the cycle and remaining based on partial payments
    {
      switch (multiplierType) {
        case 'monthly':
          // Calculate if payment occurs within the pay cycle based on day of month
          // IMPORTANT: Bills remain outstanding until explicitly marked as paid
          if (payCycleStart && payCycleEnd && daysRemaining !== undefined) {
            try {
              const nextDueDate = new Date(bill.next_due_date)
              const cycleStart = new Date(payCycleStart)
              const cycleEnd = new Date(payCycleEnd)
              const today = currentDate
              
              // Normalize dates to start of day for accurate comparison
              today.setHours(0, 0, 0, 0)
              cycleStart.setHours(0, 0, 0, 0)
              cycleEnd.setHours(0, 0, 0, 0)
              
              // Extract day of month from next_due_date (e.g., 21st)
              const dayOfMonth = nextDueDate.getDate()
              
              // Check if payment occurs within the pay cycle (past or future)
              // IMPORTANT: Bills remain outstanding until explicitly marked as paid
              // Find ALL occurrences of this day of month within the cycle
              const paymentDates: Date[] = []
              
              // Start from the first month that could contain a payment date
              // Begin at cycle start's year/month, then check each month until cycle end
              let checkYear = cycleStart.getFullYear()
              let checkMonth = cycleStart.getMonth()
              const endYear = cycleEnd.getFullYear()
              const endMonth = cycleEnd.getMonth()
              
              // Check all months within the cycle
              while (
                checkYear < endYear || 
                (checkYear === endYear && checkMonth <= endMonth)
              ) {
                // Try to create a date with this day of month in this month/year
                // Handle cases where day doesn't exist (e.g., Feb 30)
                const lastDayOfMonth = new Date(checkYear, checkMonth + 1, 0).getDate()
                const actualDayOfMonth = Math.min(dayOfMonth, lastDayOfMonth)
                
                const potentialPaymentDate = new Date(checkYear, checkMonth, actualDayOfMonth)
                potentialPaymentDate.setHours(0, 0, 0, 0)
                
                // Check if this date falls within the cycle boundaries
                if (potentialPaymentDate >= cycleStart && potentialPaymentDate <= cycleEnd) {
                  paymentDates.push(new Date(potentialPaymentDate))
                }
                
                // Move to next month
                checkMonth++
                if (checkMonth > 11) {
                  checkMonth = 0
                  checkYear++
                }
              }
              
              // If any payment date falls within the cycle, calculate remaining based on partial payments
              // Bills remain outstanding until explicitly marked as paid, regardless of date
              // Monthly bills have at most 1 payment per cycle (even if cycle spans multiple months)
              if (paymentDates.length > 0) {
                totalPayments = 1 // Monthly bills have 1 payment per cycle
                const unpaidPayments = Math.max(0, totalPayments - paymentsPaid)
                remaining = unpaidPayments > 0 ? monthly : 0
              } else {
                // No payment date in this cycle
                remaining = 0
                totalPayments = 0
              }
            } catch {
              // Fallback to monthly value if date parsing fails
              totalPayments = 1
              const unpaidPayments = Math.max(0, 1 - paymentsPaid)
              remaining = unpaidPayments > 0 ? monthly : 0
            }
          } else {
            // Fallback: use monthly value
            totalPayments = 1
            const unpaidPayments = Math.max(0, 1 - paymentsPaid)
            remaining = unpaidPayments > 0 ? monthly : 0
          }
          break
        
        case 'weekly':
          // Calculate weeks remaining based on payment day and pay cycle dates
          // IMPORTANT: Weekly payments remain outstanding until explicitly marked as paid
          if (bill.payment_day !== null && bill.payment_day !== undefined && payCycleStart && payCycleEnd) {
            const today = new Date(currentDate)
            const paymentDay = bill.payment_day // 0 = Sunday, 6 = Saturday
            const cycleStart = new Date(payCycleStart)
            const cycleEnd = new Date(payCycleEnd)
            
            // Normalize dates to start of day for accurate comparison
            today.setHours(0, 0, 0, 0)
            cycleStart.setHours(0, 0, 0, 0)
            cycleEnd.setHours(0, 0, 0, 0)
            
            // Find the first payment date on or after cycle start
            // This includes past payment dates - bills remain outstanding until paid
            const daysFromCycleStart = (paymentDay - cycleStart.getDay() + 7) % 7
            let firstPaymentDate = new Date(cycleStart)
            
            if (daysFromCycleStart === 0 && cycleStart.getDay() === paymentDay) {
              // Cycle start is the payment day
              firstPaymentDate = new Date(cycleStart)
            } else if (daysFromCycleStart === 0) {
              // Payment day was earlier in the week cycle start falls on
              firstPaymentDate.setDate(cycleStart.getDate() + 7 - cycleStart.getDay() + paymentDay)
            } else {
              // Payment day is later in the week
              firstPaymentDate.setDate(cycleStart.getDate() + daysFromCycleStart)
            }
            
            // Count ALL payment occurrences within the pay cycle (past and future)
            weeksRemaining = 0
            let checkDate = new Date(firstPaymentDate)
            
            // Count all occurrences within cycle boundaries (includes past dates)
            while (checkDate <= cycleEnd && checkDate >= cycleStart) {
              weeksRemaining++
              // Move to next week (same day of week)
              checkDate.setDate(checkDate.getDate() + 7)
            }
            
            // Ensure weeksRemaining is at least 0
            weeksRemaining = Math.max(0, weeksRemaining)
            totalPayments = weeksRemaining
            
            // For weekly, amount is already per week
            // Calculate remaining based on unpaid payments
            const unpaidPayments = Math.max(0, weeksRemaining - paymentsPaid)
            remaining = bill.amount * unpaidPayments
          } else {
            // Fallback: estimate weeks based on days remaining
            weeksRemaining = daysRemaining ? Math.ceil((daysRemaining || 0) / 7) : null
            totalPayments = weeksRemaining || 0
            const unpaidPayments = Math.max(0, totalPayments - paymentsPaid)
            remaining = bill.amount * unpaidPayments
          }
          break
        
        case 'one_off':
          // Check if the one-off payment date is within the pay cycle
          if (payCycleStart && payCycleEnd) {
            try {
              const paymentDate = new Date(bill.next_due_date)
              const cycleStart = new Date(payCycleStart)
              const cycleEnd = new Date(payCycleEnd)
              
              // If payment date is within the cycle, calculate remaining based on partial payments
              if (paymentDate >= cycleStart && paymentDate <= cycleEnd) {
                totalPayments = 1
                const unpaidPayments = Math.max(0, 1 - paymentsPaid)
                remaining = bill.amount * unpaidPayments
              } else {
                // Payment is outside the cycle
                remaining = 0
                totalPayments = 0
              }
            } catch {
              // Fallback: use amount if date parsing fails, but account for payments
              totalPayments = 1
              const unpaidPayments = Math.max(0, 1 - paymentsPaid)
              remaining = bill.amount * unpaidPayments
            }
          } else {
            // Fallback: use amount, but account for payments
            totalPayments = 1
            const unpaidPayments = Math.max(0, 1 - paymentsPaid)
            remaining = bill.amount * unpaidPayments
          }
          break
        
        default:
          // Default to monthly, but account for payments
          totalPayments = 1
          const unpaidPayments = Math.max(0, 1 - paymentsPaid)
          remaining = unpaidPayments > 0 ? monthly : 0
      }
    }

    // Calculate weeks remaining in pay cycle for ALL bill types
    // This is based on the days remaining in the pay cycle period (Today's Date to Pay Cycle End)
    if (daysRemaining !== undefined && daysRemaining !== null && daysRemaining >= 0) {
      // Calculate weeks remaining: round up to show full weeks
      // e.g., 19 days = 2.71 weeks, round up to 3 weeks
      weeksRemaining = Math.ceil(daysRemaining / 7)
    } else if (payCycleStart && payCycleEnd) {
      // Fallback: calculate from pay cycle dates if daysRemaining not provided
      try {
        const cycleEnd = new Date(payCycleEnd)
        const today = new Date(currentDate)
        today.setHours(0, 0, 0, 0)
        cycleEnd.setHours(0, 0, 0, 0)
        
        const daysRemainingCalc = Math.max(0, Math.ceil((cycleEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
        weeksRemaining = Math.ceil(daysRemainingCalc / 7)
      } catch {
        // Keep existing weeksRemaining value (null or calculated for weekly bills)
      }
    }

    return {
      bill: {
        id: bill.id,
        company_name: bill.company_name,
        amount: bill.amount,
        typical_amount: bill.typical_amount ?? null,
        charge_cycle: bill.charge_cycle as BillWithRemaining['bill']['charge_cycle'],
        next_due_date: bill.next_due_date,
        billing_account_id: bill.billing_account_id,
        category: bill.category,
        multiplier_type: multiplierType as 'monthly' | 'weekly' | 'one_off' | null,
        payment_day: bill.payment_day ?? null,
      },
      totalWeeklyCost: weekly,
      totalMonthlyCost: monthly,
      remainingThisMonth: remaining,
      weeksRemaining,
      totalPayments: totalPayments || 1, // Default to 1 if not calculated
      paymentsPaid: paymentsPaid,
    }
  })
}

/**
 * Calculate total bills remaining this month (pay cycle aware)
 */
export function calculateTotalBillsRemaining(
  bills: Array<{
    id: string
    amount: number
    charge_cycle: string
    next_due_date: string
    multiplier_type?: 'monthly' | 'weekly' | 'one_off' | null
    payment_day?: number | null
  }>,
  billPaymentsPaid: Record<string, number>,
  payCycleStart?: string,
  payCycleEnd?: string,
  currentDate: Date = new Date()
): number {
  // Use the breakdown calculation to get accurate totals with partial payments
  const breakdown = calculateBillsBreakdown(
    bills.map(b => ({
      id: b.id,
      company_name: '',
      amount: b.amount,
      charge_cycle: b.charge_cycle,
      next_due_date: b.next_due_date,
      billing_account_id: null,
      category: null,
      multiplier_type: b.multiplier_type,
      payment_day: b.payment_day,
    })),
    billPaymentsPaid,
    payCycleStart,
    payCycleEnd,
    undefined,
    currentDate
  )
  return breakdown.reduce((sum, item) => sum + item.remainingThisMonth, 0)
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

/**
 * Format next due date for display (e.g., "19-Sep", "24th", "Weekly")
 */
export function formatNextDueDate(
  nextDueDate: string,
  chargeCycle: string
): string {
  // For weekly/biweekly cycles, show the cycle name
  if (chargeCycle.toLowerCase() === 'weekly') {
    return 'Weekly'
  }
  if (chargeCycle.toLowerCase() === 'biweekly') {
    return 'Bi-weekly'
  }

  // For date-based cycles, format the date
  try {
    const date = new Date(nextDueDate)
    if (isNaN(date.getTime())) {
      return chargeCycle.charAt(0).toUpperCase() + chargeCycle.slice(1)
    }

    // Format as "DD-MMM" (e.g., "19-Sep", "24-Nov")
    const day = date.getDate()
    const month = date.toLocaleDateString('en-AU', { month: 'short' })
    return `${day}-${month}`
  } catch {
    return chargeCycle.charAt(0).toUpperCase() + chargeCycle.slice(1)
  }
}

/**
 * Calculate remaining amount for a bill within the pay cycle
 */
export function calculateRemainingInPayCycle(
  amount: number,
  chargeCycle: string,
  nextDueDate: string,
  payCycleStart: string,
  payCycleEnd: string,
  currentDate: Date = new Date()
): number {
  const dueDate = new Date(nextDueDate)
  const cycleStart = new Date(payCycleStart)
  const cycleEnd = new Date(payCycleEnd)
  const today = currentDate

  // If bill is already paid, return 0
  if (dueDate < today && today > cycleStart) {
    // Bill was due before today and we're past the start of the cycle
    // Check if it's within the pay cycle
    if (dueDate >= cycleStart && dueDate <= cycleEnd) {
      return amount
    }
  }

  // If due date is within pay cycle
  if (dueDate >= cycleStart && dueDate <= cycleEnd) {
    // For weekly bills, calculate how many payments occur in the cycle
    if (chargeCycle.toLowerCase() === 'weekly') {
      const weeksBetween = Math.ceil((cycleEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7))
      const weeksInCycle = Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24 * 7))
      // Count remaining payments in cycle
      if (dueDate > today) {
        const paymentsRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7))
        return amount * Math.max(1, paymentsRemaining)
      }
      return amount * Math.max(1, Math.ceil((cycleEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1)
    }

    // For monthly and longer cycles, return full amount if due in cycle
    return amount
  }

  // Bill not due in this pay cycle
  return 0
}
