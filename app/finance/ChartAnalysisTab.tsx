'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { getAllProjections, getAccounts, getBills, type FinanceProjection, type FinanceAccount, type FinanceBill } from '@/app/actions/finance'
import { formatCurrency, getDaysRemainingInMonth } from '@/lib/financeUtils'
import { TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, PiggyBank, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface ChartAnalysisTabProps {
  initialProjections?: FinanceProjection[]
  initialAccounts?: FinanceAccount[]
  initialBills?: FinanceBill[]
}

// Color palette for charts (glass-friendly colors)
const CHART_COLORS = {
  primary: '#8884d8',
  secondary: '#82ca9d',
  tertiary: '#ffc658',
  quaternary: '#ff7c7c',
  quinary: '#8dd1e1',
  senary: '#d084d0',
  septenary: '#ffb347',
  octonary: '#87ceeb',
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking: '#8884d8',
  savings: '#82ca9d',
  credit: '#ff7c7c',
  investment: '#ffc658',
  other: '#8dd1e1',
}

/**
 * Enhanced Chart Analysis Tab Component
 * Displays comprehensive visualizations of financial data including:
 * - Cash flow trends over time
 * - Account balance breakdowns
 * - Bill category analysis
 * - Spending velocity and trends
 * - Monthly comparisons
 * - Key insights and metrics
 */
export default function ChartAnalysisTab({ 
  initialProjections = [],
  initialAccounts = [],
  initialBills = [],
}: ChartAnalysisTabProps) {
  const { resolvedTheme } = useTheme()
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [accounts, setAccounts] = useState<FinanceAccount[]>(initialAccounts)
  const [bills, setBills] = useState<FinanceBill[]>(initialBills)
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'last12' | 'last6' | 'last3'>('all')
  
  // Theme-aware colors for charts
  const isDark = resolvedTheme === 'dark'
  const chartTextColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
  const chartStrokeColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
  const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  const chartLegendColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'

  // Load all historical projections
  const loadProjections = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getAllProjections()
      if (result.error) {
        console.error('Failed to load projections:', result.error)
      } else if (result.data) {
        setProjections(result.data)
      }
    } catch (error) {
      console.error('Error loading projections:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load accounts if not provided
  const loadAccounts = useCallback(async () => {
    if (initialAccounts.length === 0) {
      try {
        const result = await getAccounts()
        if (result.data) {
          setAccounts(result.data)
        }
      } catch (error) {
        console.error('Error loading accounts:', error)
      }
    }
  }, [initialAccounts.length])

  // Load bills if not provided
  const loadBills = useCallback(async () => {
    if (initialBills.length === 0) {
      try {
        const result = await getBills()
        if (result.data) {
          setBills(result.data)
        }
      } catch (error) {
        console.error('Error loading bills:', error)
      }
    }
  }, [initialBills.length])

  // Load data on mount if not provided
  useEffect(() => {
    if (initialProjections.length === 0) {
      loadProjections()
    }
    loadAccounts()
    loadBills()
  }, [initialProjections.length, loadProjections, loadAccounts, loadBills])

  // Filter projections by date range and prepare chart data
  const chartData = useMemo(() => {
    let filtered = [...projections]

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      const monthsAgo = dateRange === 'last12' ? 12 : dateRange === 'last6' ? 6 : 3
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
      filtered = filtered.filter(p => new Date(p.projection_date) >= cutoffDate)
    }

    // Group by date and get latest projection per day
    const groupedByDate = new Map<string, FinanceProjection[]>()
    
    filtered.forEach(projection => {
      const date = projection.projection_date
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, [])
      }
      groupedByDate.get(date)!.push(projection)
    })

    // Convert to chart data format - take latest entry per day
    const data = Array.from(groupedByDate.entries())
      .map(([date, projs]) => {
        // Sort by entry_time descending and take the latest
        const sorted = [...projs].sort((a, b) => {
          const timeA = a.entry_time || '00:00:00'
          const timeB = b.entry_time || '00:00:00'
          return timeB.localeCompare(timeA)
        })
        const latest = sorted[0]
        
        // Extract account balances for this projection
        const accountBalances = latest.account_balances || {}
        const accountData: Record<string, number> = {}
        accounts.forEach(account => {
          accountData[`account_${account.id}`] = accountBalances[account.id] || 0
        })
        
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          fullDate: date,
          dateTimestamp: new Date(date).getTime(), // For proper sorting
          cashAvailable: latest.cash_available,
          totalAvailable: latest.total_available,
          billsRemaining: latest.bills_remaining,
          cashPerWeek: latest.cash_per_week || 0,
          spendingPerDay: latest.spending_per_day || 0,
          daysRemaining: latest.days_remaining,
          billsAmount: latest.bills_amount || 0,
          ...accountData,
        }
      })
      .sort((a, b) => a.dateTimestamp - b.dateTimestamp)

    return data
  }, [projections, dateRange, accounts])

  // Get the actual days remaining in the current month
  const actualDaysRemaining = useMemo(() => {
    return getDaysRemainingInMonth(new Date())
  }, [])

  // Get the most relevant projection (for current cash calculation)
  // This should be the projection where days_remaining is closest to the actual days remaining
  const mostRecentProjection = useMemo(() => {
    if (projections.length === 0) return null
    
    // Calculate the actual days remaining in the current month
    const currentDaysRemaining = getDaysRemainingInMonth(new Date())
    
    // Find the projection where days_remaining is closest to the actual days remaining
    // If multiple have the same days_remaining, prefer the most recent date/time
    const sorted = [...projections]
      .map(proj => ({
        proj,
        daysDiff: Math.abs(proj.days_remaining - currentDaysRemaining),
        dateTime: new Date(`${proj.projection_date}T${proj.entry_time || '00:00:00'}`).getTime(),
      }))
      .sort((a, b) => {
        // First, sort by how close days_remaining is to actual (closest first)
        if (a.daysDiff !== b.daysDiff) {
          return a.daysDiff - b.daysDiff
        }
        // If same difference, prefer the most recent date/time
        return b.dateTime - a.dateTime
      })
    
    return sorted[0]?.proj || null
  }, [projections, actualDaysRemaining])

  // Calculate enhanced summary statistics with trends
  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const cashValues = chartData.map(d => d.cashAvailable)
    const totalValues = chartData.map(d => d.totalAvailable)
    const cashPerWeekValues = chartData.map(d => d.cashPerWeek).filter(v => v > 0)
    const spendingPerDayValues = chartData.map(d => d.spendingPerDay).filter(v => v > 0)

    // Calculate trends (compare first half vs second half)
    const midPoint = Math.floor(chartData.length / 2)
    const firstHalfAvg = midPoint > 0 
      ? cashValues.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint
      : 0
    const secondHalfAvg = midPoint < cashValues.length
      ? cashValues.slice(midPoint).reduce((a, b) => a + b, 0) / (cashValues.length - midPoint)
      : firstHalfAvg
    
    const cashTrend = firstHalfAvg > 0 
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0

    // Get current cash from the most relevant projection (closest days_remaining to actual)
    const currentCash = mostRecentProjection?.cash_available || 0
    
    // Get previous cash from the second closest projection for comparison
    let previousCash = 0
    if (projections.length > 1 && mostRecentProjection) {
      const currentDaysRemaining = getDaysRemainingInMonth(new Date())
      
      // Find the second closest projection (excluding the one we already selected)
      const sorted = [...projections]
        .filter(p => p.id !== mostRecentProjection.id) // Exclude the current one
        .map(proj => ({
          proj,
          daysDiff: Math.abs(proj.days_remaining - currentDaysRemaining),
          dateTime: new Date(`${proj.projection_date}T${proj.entry_time || '00:00:00'}`).getTime(),
        }))
        .sort((a, b) => {
          // First, sort by how close days_remaining is to actual (closest first)
          if (a.daysDiff !== b.daysDiff) {
            return a.daysDiff - b.daysDiff
          }
          // If same difference, prefer the most recent date/time
          return b.dateTime - a.dateTime
        })
      
      previousCash = sorted[0]?.proj?.cash_available || 0
    }

    return {
      avgCashAvailable: cashValues.reduce((a, b) => a + b, 0) / cashValues.length,
      maxCashAvailable: Math.max(...cashValues),
      minCashAvailable: Math.min(...cashValues),
      avgTotalAvailable: totalValues.reduce((a, b) => a + b, 0) / totalValues.length,
      avgCashPerWeek: cashPerWeekValues.length > 0 
        ? cashPerWeekValues.reduce((a, b) => a + b, 0) / cashPerWeekValues.length 
        : 0,
      avgSpendingPerDay: spendingPerDayValues.length > 0
        ? spendingPerDayValues.reduce((a, b) => a + b, 0) / spendingPerDayValues.length
        : 0,
      cashTrend,
      currentCash,
      previousCash,
    }
  }, [chartData, mostRecentProjection, projections])

  // Calculate bill category breakdown
  const billCategoryData = useMemo(() => {
    const categoryMap = new Map<string, number>()
    
    bills.forEach(bill => {
      const category = bill.category || 'Uncategorized'
      const current = categoryMap.get(category) || 0
      categoryMap.set(category, current + Number(bill.amount))
    })

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [bills])

  // Calculate account balance trends
  const accountBalanceData = useMemo(() => {
    if (accounts.length === 0) return []
    
    return chartData.map(dataPoint => {
      const accountBalances: Record<string, number> = {}
      accounts.forEach(account => {
        const key = `account_${account.id}`
        accountBalances[account.name] = dataPoint[key] || 0
      })
      return {
        date: dataPoint.date,
        fullDate: dataPoint.fullDate,
        ...accountBalances,
      }
    })
  }, [chartData, accounts])

  // Calculate monthly average cash per week data
  // NOTE: Use raw projections, not chartData, because chartData only has one entry per day
  const monthlyCashPerWeekData = useMemo(() => {
    const monthlyMap = new Map<string, number[]>()
    
    // Filter projections by date range (same logic as chartData)
    let filtered = [...projections]
    if (dateRange !== 'all') {
      const now = new Date()
      const monthsAgo = dateRange === 'last12' ? 12 : dateRange === 'last6' ? 6 : 3
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
      filtered = filtered.filter(p => new Date(p.projection_date) >= cutoffDate)
    }
    
    // Process ALL projections for the month, not just one per day
    filtered.forEach(projection => {
      const date = new Date(projection.projection_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      // Calculate cash per week for this projection
      // Formula: cash_per_week = cash_available / (days_remaining / 7)
      if (projection.days_remaining > 0 && projection.cash_available > 0) {
        const weeksRemaining = projection.days_remaining / 7
        const cashPerWeek = projection.cash_available / weeksRemaining
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, [])
        }
        
        monthlyMap.get(monthKey)!.push(cashPerWeek)
      }
    })

    const baseData = Array.from(monthlyMap.entries())
      .map(([monthKey, cashPerWeekValues]) => {
        const date = new Date(monthKey + '-01')
        
        // Calculate average: sum all values, then divide by count
        const sum = cashPerWeekValues.reduce((a, b) => a + b, 0)
        const count = cashPerWeekValues.length
        const avgCashPerWeek = count > 0 ? sum / count : 0
        
        return {
          monthKey, // Preserve for sorting
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          avgCashPerWeek,
        }
      })
      .filter(item => item.avgCashPerWeek > 0) // Only include months with valid data
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey)) // Sort by YYYY-MM format

    // Calculate 18-month moving average
    const windowSize = 18
    const dataWithMovingAvg = baseData.map((item, index) => {
      // Calculate moving average: average of current month and previous (windowSize - 1) months
      let movingAvg = item.avgCashPerWeek
      
      if (index >= windowSize - 1) {
        // We have enough data points for a full window
        const windowData = baseData.slice(index - (windowSize - 1), index + 1)
        const sum = windowData.reduce((acc, d) => acc + d.avgCashPerWeek, 0)
        movingAvg = sum / windowSize
      } else if (index > 0) {
        // Partial window: average of available months
        const windowData = baseData.slice(0, index + 1)
        const sum = windowData.reduce((acc, d) => acc + d.avgCashPerWeek, 0)
        movingAvg = sum / (index + 1)
      }
      
      return {
        ...item,
        movingAvg,
      }
    })

    return dataWithMovingAvg
  }, [projections, dateRange])

  // Calculate monthly comparison data
  const monthlyComparisonData = useMemo(() => {
    const monthlyMap = new Map<string, { cash: number[]; bills: number[]; count: number }>()
    
    chartData.forEach(dataPoint => {
      const date = new Date(dataPoint.fullDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { cash: [], bills: [], count: 0 })
      }
      
      const monthData = monthlyMap.get(monthKey)!
      monthData.cash.push(dataPoint.cashAvailable)
      monthData.bills.push(dataPoint.billsRemaining)
      monthData.count++
    })

    return Array.from(monthlyMap.entries())
      .map(([monthKey, data]) => ({
        monthKey, // Preserve for sorting
        month: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        avgCash: data.cash.reduce((a, b) => a + b, 0) / data.cash.length,
        avgBills: data.bills.reduce((a, b) => a + b, 0) / data.bills.length,
        dataPoints: data.count,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey)) // Sort by YYYY-MM format
      .slice(-6) // Last 6 months
  }, [chartData])

  // Custom tooltip formatter
  const formatTooltipValue = useCallback((value: number, name: string) => {
    if (typeof value === 'number') {
      return [formatCurrency(value), name]
    }
    return [value, name]
  }, [])

  // Custom date tick formatter to ensure year is always shown
  const formatDateTick = useCallback((tickItem: string) => {
    // If the tick is already formatted with year, return as is
    if (tickItem && /\d{4}/.test(tickItem)) {
      return tickItem
    }
    // Otherwise, try to parse and format with year
    try {
      const date = new Date(tickItem)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    } catch {
      // Fallback to original if parsing fails
    }
    return tickItem
  }, [])

  // Custom tooltip component - always dark mode for readability
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 dark:bg-slate-900 p-3 rounded-lg border border-slate-700 shadow-xl">
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-slate-300 text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="glass-medium p-8 rounded-lg text-center">
        <p className="glass-text-secondary">Loading chart data...</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="glass-medium p-8 rounded-lg text-center">
        <p className="glass-text-secondary">
          {projections.length === 0 
            ? 'No data available. Start tracking your spending to see visualizations here.' 
            : 'No data in the selected date range.'}
        </p>
      </div>
    )
  }

  const cashChange = stats && stats.previousCash > 0
    ? ((stats.currentCash - stats.previousCash) / stats.previousCash) * 100
    : 0

  return (
    <div className="space-y-6 pb-6">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="glass-text-primary text-2xl font-bold mb-2">Financial Analytics</h2>
          <p className="glass-text-secondary text-sm">
            Comprehensive insights into your financial trends and patterns
          </p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger className="w-[160px] glass-small">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="last12">Last 12 Months</SelectItem>
            <SelectItem value="last6">Last 6 Months</SelectItem>
            <SelectItem value="last3">Last 3 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Enhanced Key Metrics with Trend Indicators */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-medium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="glass-text-tertiary text-xs">Current Cash Available</p>
                <DollarSign className="h-4 w-4 glass-text-secondary" />
              </div>
              <p className="glass-text-primary font-bold text-xl mb-1">
                {formatCurrency(stats.currentCash)}
              </p>
              {cashChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${cashChange > 0 ? 'text-[var(--glass-success-text)]' : 'text-[var(--glass-error-text)]'}`}>
                  {cashChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{Math.abs(cashChange).toFixed(1)}%</span>
                  <span className="glass-text-tertiary">vs previous</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-medium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="glass-text-tertiary text-xs">Average Cash Available</p>
                <Wallet className="h-4 w-4 glass-text-secondary" />
              </div>
              <p className="glass-text-primary font-bold text-xl mb-1">
                {formatCurrency(stats.avgCashAvailable)}
              </p>
              {stats.cashTrend !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${stats.cashTrend > 0 ? 'text-[var(--glass-success-text)]' : 'text-[var(--glass-error-text)]'}`}>
                  {stats.cashTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{Math.abs(stats.cashTrend).toFixed(1)}%</span>
                  <span className="glass-text-tertiary">trend</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-medium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="glass-text-tertiary text-xs">Weekly Spending Capacity</p>
                <PiggyBank className="h-4 w-4 glass-text-secondary" />
              </div>
              <p className="glass-text-primary font-bold text-xl">
                {formatCurrency(stats.avgCashPerWeek)}
              </p>
              {stats.avgSpendingPerDay > 0 && (
                <p className="glass-text-tertiary text-xs mt-1">
                  {formatCurrency(stats.avgSpendingPerDay)}/day
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-medium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="glass-text-tertiary text-xs">Total Available</p>
                <CreditCard className="h-4 w-4 glass-text-secondary" />
              </div>
              <p className="glass-text-primary font-bold text-xl">
                {formatCurrency(stats.avgTotalAvailable)}
              </p>
              <p className="glass-text-tertiary text-xs mt-1">
                Range: {formatCurrency(stats.minCashAvailable)} - {formatCurrency(stats.maxCashAvailable)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash per Week Over Time - Monthly Averages */}
      {monthlyCashPerWeekData.length > 0 && (
        <Card className="glass-large">
          <CardHeader>
            <CardTitle className="glass-text-primary">Average Cash per Week by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={monthlyCashPerWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis 
                  dataKey="month" 
                  stroke={chartStrokeColor}
                  tick={{ fill: chartTextColor, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke={chartStrokeColor}
                  tick={{ fill: chartTextColor, fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                  label={{ value: 'Cash per Week', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartTextColor } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: chartLegendColor }} />
                <Bar 
                  dataKey="avgCashPerWeek" 
                  fill={CHART_COLORS.primary} 
                  name="Average Cash per Week"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  stroke={CHART_COLORS.secondary}
                  strokeWidth={3}
                  name="18-Month Moving Average"
                  dot={{ fill: CHART_COLORS.secondary, r: 4 }}
                  strokeDasharray="0"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cash Flow Over Time - Enhanced */}
      <Card className="glass-large">
        <CardHeader>
          <CardTitle className="glass-text-primary">Cash Flow Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis 
                dataKey="date" 
                stroke={chartStrokeColor}
                tick={{ fill: chartTextColor, fontSize: 12 }}
                tickFormatter={formatDateTick}
                angle={-45}
                textAnchor="end"
                height={60}
                type="category"
              />
              <YAxis 
                stroke={chartStrokeColor}
                tick={{ fill: chartTextColor, fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: chartLegendColor }} />
              <Area
                type="monotone"
                dataKey="cashAvailable"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCash)"
                name="Cash Available"
              />
              <Area
                type="monotone"
                dataKey="totalAvailable"
                stroke={CHART_COLORS.secondary}
                strokeWidth={2}
                fillOpacity={0}
                name="Total Available"
              />
              <Line
                type="monotone"
                dataKey="billsRemaining"
                stroke={CHART_COLORS.tertiary}
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Bills Remaining"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Account Balance Breakdown - New */}
      {accounts.length > 0 && accountBalanceData.length > 0 && (
        <Card className="glass-large">
          <CardHeader>
            <CardTitle className="glass-text-primary">Account Balance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={accountBalanceData}>
                <defs>
                  {accounts.map((account, index) => {
                    const color = ACCOUNT_TYPE_COLORS[account.account_type] || CHART_COLORS.primary
                    return (
                      <linearGradient key={account.id} id={`colorAccount${account.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    )
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis 
                  dataKey="date" 
                  stroke={chartStrokeColor}
                  tick={{ fill: chartTextColor, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke={chartStrokeColor}
                  tick={{ fill: chartTextColor, fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: chartLegendColor }} />
                {accounts.map((account) => {
                  const color = ACCOUNT_TYPE_COLORS[account.account_type] || CHART_COLORS.primary
                  return (
                    <Area
                      key={account.id}
                      type="monotone"
                      dataKey={account.name}
                      stackId="1"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#colorAccount${account.id})`}
                      name={account.name}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bill Category Breakdown - New */}
      {billCategoryData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-large">
            <CardHeader>
              <CardTitle className="glass-text-primary">Bill Distribution by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={billCategoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {billCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.keys(CHART_COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipValue} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Comparison - New */}
          {monthlyComparisonData.length > 0 && (
            <Card className="glass-large">
              <CardHeader>
                <CardTitle className="glass-text-primary">Monthly Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis 
                      dataKey="month" 
                      stroke={chartStrokeColor}
                      tick={{ fill: chartTextColor, fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      type="category"
                    />
                    <YAxis 
                      stroke={chartStrokeColor}
                      tick={{ fill: chartTextColor, fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: chartLegendColor }} />
                    <Bar dataKey="avgCash" fill={CHART_COLORS.primary} name="Avg Cash Available" />
                    <Bar dataKey="avgBills" fill={CHART_COLORS.tertiary} name="Avg Bills Remaining" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Spending Velocity Trends - Enhanced */}
      <Card className="glass-large">
        <CardHeader>
          <CardTitle className="glass-text-primary">Spending Velocity & Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis 
                dataKey="date" 
                stroke={chartStrokeColor}
                tick={{ fill: chartTextColor, fontSize: 12 }}
                tickFormatter={formatDateTick}
                angle={-45}
                textAnchor="end"
                height={60}
                type="category"
              />
              <YAxis 
                yAxisId="left"
                stroke={chartStrokeColor}
                tick={{ fill: chartTextColor, fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke={chartStrokeColor}
                tick={{ fill: chartTextColor, fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: chartLegendColor }} />
              <Bar yAxisId="left" dataKey="cashPerWeek" fill={CHART_COLORS.primary} name="Weekly Capacity" />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="spendingPerDay" 
                stroke={CHART_COLORS.secondary} 
                strokeWidth={3}
                name="Daily Spending Capacity"
                dot={{ fill: CHART_COLORS.secondary, r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="daysRemaining" 
                stroke={CHART_COLORS.quaternary} 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Days Remaining"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Data Summary */}
      <div className="glass-small p-4 rounded-lg">
        <p className="glass-text-secondary text-sm">
          Showing <span className="glass-text-primary font-semibold">{chartData.length}</span> data points
          {accounts.length > 0 && ` across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
          {bills.length > 0 && ` and ${bills.length} bill${bills.length !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  )
}
