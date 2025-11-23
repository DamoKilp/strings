'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
export interface FinanceAccount {
  id: string
  user_id: string
  name: string
  account_type: 'checking' | 'savings' | 'credit' | 'investment' | 'other'
  balance: number
  currency: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FinanceBill {
  id: string
  user_id: string
  company_name: string
  amount: number
  typical_amount: number | null
  charge_cycle: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  next_due_date: string
  billing_account_id: string | null
  category: string | null
  notes: string | null
  multiplier_type: 'monthly' | 'weekly' | 'one_off' | null
  payment_day: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FinanceProjection {
  id: string
  user_id: string
  projection_date: string
  days_remaining: number
  entry_time: string | null // Time in HH:MM:SS format
  account_balances: Record<string, number>
  bills_amount: number
  total_available: number
  bills_remaining: number
  cash_available: number
  cash_per_week: number | null
  spending_per_day: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MonthlySnapshot {
  id: string
  user_id: string
  month_year: string
  snapshot_date: string
  account_balances: Record<string, number>
  bill_statuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid?: number }>
  cash_flow_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface BillingPeriod {
  id: string
  user_id: string
  period_name: string
  start_date: string
  end_date: string
  is_active: boolean
  snapshot_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Account Actions
export async function getAccounts(): Promise<{ data: FinanceAccount[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_accounts')
      .select('id,name,account_type,balance,currency,is_active,sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data as FinanceAccount[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function upsertAccount(account: Partial<FinanceAccount> & { name: string; account_type: FinanceAccount['account_type'] }): Promise<{ data: FinanceAccount | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const insertData = {
      user_id: user.id,
      name: account.name,
      account_type: account.account_type,
      balance: account.balance ?? 0,
      currency: account.currency ?? 'AUD',
      is_active: account.is_active ?? true,
      sort_order: account.sort_order ?? 0,
      updated_at: new Date().toISOString(),
      ...(account.id && { id: account.id }),
    }

    const { data, error } = await supabase
      .from('finance_accounts')
      .upsert(insertData as any)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as FinanceAccount, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateAccountBalance(accountId: string, balance: number): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('finance_accounts')
      // @ts-expect-error - Supabase update types need proper schema
      .update({ balance, updated_at: new Date().toISOString() } as any)
      .eq('id', accountId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Bill Actions
export async function getBills(): Promise<{ data: FinanceBill[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_bills')
      .select('id,company_name,amount,typical_amount,charge_cycle,next_due_date,billing_account_id,category,multiplier_type,payment_day,is_active,sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data as FinanceBill[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function upsertBill(bill: Partial<FinanceBill> & { company_name: string; amount: number; charge_cycle: FinanceBill['charge_cycle']; next_due_date: string; multiplier_type?: 'monthly' | 'weekly' | 'one_off' | null; payment_day?: number | null }): Promise<{ data: FinanceBill | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const insertData = {
      user_id: user.id,
      company_name: bill.company_name,
      amount: bill.amount,
      typical_amount: bill.typical_amount ?? null,
      charge_cycle: bill.charge_cycle,
      next_due_date: bill.next_due_date,
      billing_account_id: bill.billing_account_id ?? null,
      category: bill.category ?? null,
      notes: bill.notes ?? null,
      multiplier_type: bill.multiplier_type ?? 'monthly',
      payment_day: bill.payment_day ?? null,
      is_active: bill.is_active ?? true,
      sort_order: bill.sort_order ?? 0,
      updated_at: new Date().toISOString(),
      ...(bill.id && { id: bill.id }),
    }

    const { data, error } = await supabase
      .from('finance_bills')
      .upsert(insertData as any)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as FinanceBill, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteBill(billId: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('finance_bills')
      .delete()
      .eq('id', billId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Projection Actions
export async function getProjection(projectionDate: string): Promise<{ data: FinanceProjection | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_projections')
      .select('*')
      .eq('user_id', user.id)
      .eq('projection_date', projectionDate)
      .order('days_remaining', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    return { data: data as FinanceProjection | null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function upsertProjection(projection: Partial<FinanceProjection> & { projection_date: string; days_remaining: number; account_balances: Record<string, number>; total_available: number; bills_remaining: number; cash_available: number }): Promise<{ data: FinanceProjection | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    // Format time as HH:MM:SS if provided, otherwise use current time
    const now = new Date()
    const entryTime = projection.entry_time || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    
    const insertData = {
      user_id: user.id,
      projection_date: projection.projection_date,
      days_remaining: projection.days_remaining,
      entry_time: entryTime,
      account_balances: projection.account_balances as unknown as Record<string, never>, // JSON type
      total_available: projection.total_available,
      bills_remaining: projection.bills_remaining,
      cash_available: projection.cash_available,
      bills_amount: projection.bills_amount ?? 0,
      cash_per_week: projection.cash_per_week ?? null,
      spending_per_day: projection.spending_per_day ?? null,
      notes: projection.notes ?? null,
      updated_at: new Date().toISOString(),
      ...(projection.id && { id: projection.id }),
    }

    let data, error
    
    // If we have an ID, use update instead of upsert to avoid primary key conflicts
    if (projection.id) {
      // Remove id from update data since we're updating by id
      const { id, ...updateData } = insertData
      const { data: updateResult, error: updateError } = await supabase
        .from('finance_projections')
        .update(updateData as any)
        .eq('id', projection.id)
        .select()
        .single()
      data = updateResult
      error = updateError
    } else {
      // No ID, use upsert with conflict resolution
      const { data: upsertData, error: upsertError } = await supabase
        .from('finance_projections')
        .upsert(insertData as any, {
          onConflict: 'user_id,projection_date,days_remaining,entry_time'
        })
        .select()
        .single()
      data = upsertData
      error = upsertError
    }

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as unknown as FinanceProjection, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getProjections(monthYear?: string): Promise<{ data: FinanceProjection[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    let query = supabase
      .from('finance_projections')
      .select('*')
      .eq('user_id', user.id)
      .order('projection_date', { ascending: false })
      .order('days_remaining', { ascending: true })
      .order('entry_time', { ascending: false }) // Most recent first within same date/days

    if (monthYear) {
      // Filter by month/year if provided
      const [year, month] = monthYear.split('-')
      query = query
        .gte('projection_date', `${year}-${month}-01`)
        .lt('projection_date', `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`)
    }

    const { data, error } = await query

    if (error) return { data: null, error: error.message }
    return { data: data as unknown as FinanceProjection[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getAllProjections(): Promise<{ data: FinanceProjection[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_projections')
      .select('*')
      .eq('user_id', user.id)
      .order('projection_date', { ascending: false })
      .order('days_remaining', { ascending: true })
      .order('entry_time', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data as unknown as FinanceProjection[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteProjection(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('finance_projections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function bulkInsertProjections(projections: Array<Partial<FinanceProjection> & { projection_date: string; days_remaining: number; account_balances: Record<string, number>; total_available: number; bills_remaining: number; cash_available: number }>): Promise<{ data: FinanceProjection[] | null; error: string | null; inserted: number; skipped: number }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated', inserted: 0, skipped: 0 }

    const now = new Date()
    const insertData = projections.map((projection, index) => {
      // Use provided entry_time, or generate unique one based on index
      let entryTime = projection.entry_time
      if (!entryTime) {
        // Generate unique time by incrementing seconds based on index
        // Handle overflow properly to keep time in valid range
        const secondsOffset = index % 60
        const baseSeconds = now.getSeconds()
        const totalSeconds = baseSeconds + secondsOffset
        const finalSeconds = totalSeconds % 60
        const minutesCarry = Math.floor(totalSeconds / 60)
        const finalMinutes = (now.getMinutes() + minutesCarry) % 60
        const hoursCarry = Math.floor((now.getMinutes() + minutesCarry) / 60)
        const finalHours = (now.getHours() + hoursCarry) % 24
        entryTime = `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}:${finalSeconds.toString().padStart(2, '0')}`
      }
      
      return {
        user_id: user.id,
        projection_date: projection.projection_date,
        days_remaining: projection.days_remaining,
        entry_time: entryTime,
        account_balances: projection.account_balances as unknown as Record<string, never>, // JSON type
        total_available: projection.total_available,
        bills_remaining: projection.bills_remaining,
        cash_available: projection.cash_available,
        bills_amount: projection.bills_amount ?? 0,
        cash_per_week: projection.cash_per_week ?? null,
        spending_per_day: projection.spending_per_day ?? null,
        notes: projection.notes ?? null,
        updated_at: new Date().toISOString(),
      }
    })

    // Remove duplicates within the batch before inserting
    // Group by unique key to avoid conflicts
    const uniqueMap = new Map<string, typeof insertData[0]>()
    for (const item of insertData) {
      const key = `${item.projection_date}_${item.days_remaining}_${item.entry_time}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item)
      }
    }
    
    const uniqueData = Array.from(uniqueMap.values())
    const duplicatesRemoved = insertData.length - uniqueData.length

    // Insert in batches to avoid payload size limits (100 at a time)
    const batchSize = 100
    const results: FinanceProjection[] = []
    let inserted = 0
    let skipped = 0
    const batchErrors: Array<{ batch: number; error: string; count: number }> = []

    for (let i = 0; i < uniqueData.length; i += batchSize) {
      const batch = uniqueData.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      
      const { data, error } = await supabase
        .from('finance_projections')
        .upsert(batch as any, {
          onConflict: 'user_id,projection_date,days_remaining,entry_time',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        const errorMsg = error.message || 'Unknown error'
        batchErrors.push({ batch: batchNum, error: errorMsg, count: batch.length })
        skipped += batch.length
        continue
      }

      if (data) {
        results.push(...(data as unknown as FinanceProjection[]))
        inserted += data.length
        skipped += batch.length - data.length
      }
    }
    
    // Log summary
    console.log('[BULK INSERT SUMMARY]')
    console.log(`  - Total projections to insert: ${insertData.length}`)
    console.log(`  - Duplicates removed: ${duplicatesRemoved}`)
    console.log(`  - Unique projections: ${uniqueData.length}`)
    console.log(`  - Batches processed: ${Math.ceil(uniqueData.length / batchSize)}`)
    console.log(`  - Successfully inserted: ${inserted}`)
    console.log(`  - Skipped (duplicates/errors): ${skipped}`)
    if (batchErrors.length > 0) {
      console.log(`  - Batch errors: ${batchErrors.length}`)
      batchErrors.forEach(err => {
        console.log(`    * Batch ${err.batch}: ${err.error} (${err.count} items)`)
      })
    }

    revalidatePath('/finance')
    return { data: results, error: null, inserted, skipped }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error', inserted: 0, skipped: 0 }
  }
}

// Monthly Snapshot Actions
export async function getMonthlySnapshots(): Promise<{ data: MonthlySnapshot[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_monthly_snapshots')
      .select('id,month_year,snapshot_date,account_balances,bill_statuses,cash_flow_data,created_at')
      .eq('user_id', user.id)
      .order('month_year', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data as MonthlySnapshot[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function saveMonthlySnapshot(snapshot: { month_year: string; account_balances: Record<string, number>; bill_statuses: Record<string, { paid: boolean; paid_date: string | null; payments_paid?: number }>; cash_flow_data?: Record<string, unknown>; notes?: string }): Promise<{ data: MonthlySnapshot | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const insertData = {
      user_id: user.id,
      month_year: snapshot.month_year,
      snapshot_date: new Date().toISOString().split('T')[0],
      account_balances: snapshot.account_balances as unknown as Record<string, never>, // JSON type
      bill_statuses: snapshot.bill_statuses as unknown as Record<string, never>, // JSON type
      cash_flow_data: snapshot.cash_flow_data ? snapshot.cash_flow_data as unknown as Record<string, never> : null,
      notes: snapshot.notes ?? null,
    }

    const { data, error } = await supabase
      .from('finance_monthly_snapshots')
      // @ts-ignore - Supabase upsert types need proper schema
      .upsert(insertData as any, {
        onConflict: 'user_id,month_year'
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as unknown as MonthlySnapshot, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function loadMonthlySnapshot(monthYear: string): Promise<{ data: MonthlySnapshot | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('month_year', monthYear)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    return { data: data as MonthlySnapshot | null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Billing Period Actions
export async function getBillingPeriods(): Promise<{ data: BillingPeriod[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('finance_billing_periods')
      .select('id,period_name,start_date,end_date,is_active,snapshot_id,notes,created_at,updated_at')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data as BillingPeriod[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function createBillingPeriod(period: { period_name: string; start_date: string; end_date: string; snapshot_id?: string | null; notes?: string | null }): Promise<{ data: BillingPeriod | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    // Validate dates
    const startDate = new Date(period.start_date)
    const endDate = new Date(period.end_date)
    if (endDate < startDate) {
      return { data: null, error: 'End date must be after start date' }
    }

    const insertData = {
      user_id: user.id,
      period_name: period.period_name,
      start_date: period.start_date,
      end_date: period.end_date,
      snapshot_id: period.snapshot_id ?? null,
      notes: period.notes ?? null,
      is_active: false,
    }

    const { data, error } = await supabase
      .from('finance_billing_periods')
      .insert(insertData as any)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as BillingPeriod, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateBillingPeriod(id: string, updates: Partial<{ period_name: string; start_date: string; end_date: string; is_active: boolean; snapshot_id: string | null; notes: string | null }>): Promise<{ data: BillingPeriod | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    // Validate dates if both are provided
    if (updates.start_date && updates.end_date) {
      const startDate = new Date(updates.start_date)
      const endDate = new Date(updates.end_date)
      if (endDate < startDate) {
        return { data: null, error: 'End date must be after start date' }
      }
    }

    const { data, error } = await supabase
      .from('finance_billing_periods')
      // @ts-expect-error - Supabase update types need proper schema
      .update(updates as any)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as BillingPeriod, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteBillingPeriod(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('finance_billing_periods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/finance')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
