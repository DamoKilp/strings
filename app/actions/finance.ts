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
  charge_cycle: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  next_due_date: string
  billing_account_id: string | null
  category: string | null
  notes: string | null
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
  bill_statuses: Record<string, { paid: boolean; paid_date: string | null }>
  cash_flow_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
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
      .select('id,company_name,amount,charge_cycle,next_due_date,billing_account_id,category,is_active,sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: error.message }
    return { data: data as FinanceBill[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function upsertBill(bill: Partial<FinanceBill> & { company_name: string; amount: number; charge_cycle: FinanceBill['charge_cycle']; next_due_date: string }): Promise<{ data: FinanceBill | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const insertData = {
      user_id: user.id,
      company_name: bill.company_name,
      amount: bill.amount,
      charge_cycle: bill.charge_cycle,
      next_due_date: bill.next_due_date,
      billing_account_id: bill.billing_account_id ?? null,
      category: bill.category ?? null,
      notes: bill.notes ?? null,
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

    const insertData = {
      user_id: user.id,
      projection_date: projection.projection_date,
      days_remaining: projection.days_remaining,
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

    const { data, error } = await supabase
      .from('finance_projections')
      .upsert(insertData as any, {
        onConflict: 'user_id,projection_date,days_remaining'
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/finance')
    return { data: data as unknown as FinanceProjection, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
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

export async function saveMonthlySnapshot(snapshot: { month_year: string; account_balances: Record<string, number>; bill_statuses: Record<string, { paid: boolean; paid_date: string | null }>; cash_flow_data?: Record<string, unknown>; notes?: string }): Promise<{ data: MonthlySnapshot | null; error: string | null }> {
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
      // @ts-expect-error - Supabase upsert types need proper schema
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
