'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getAllProjections, type FinanceProjection } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/financeUtils'

interface ChartAnalysisTabProps {
  initialProjections?: FinanceProjection[]
}

/**
 * Chart Analysis Tab Component
 * Displays visualizations of financial data including cash flow, spending trends, and account balances
 */
export default function ChartAnalysisTab({ 
  initialProjections = [] 
}: ChartAnalysisTabProps) {
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'last12' | 'last6' | 'last3'>('last6')

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

  // Load projections on mount if not provided
  useEffect(() => {
    if (initialProjections.length === 0) {
      loadProjections()
    }
  }, [initialProjections.length, loadProjections])

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

    // Group by date and get latest projection per day (or average)
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
        
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: date,
          cashAvailable: latest.cash_available,
          totalAvailable: latest.total_available,
          billsRemaining: latest.bills_remaining,
          cashPerWeek: latest.cash_per_week || 0,
          spendingPerDay: latest.spending_per_day || 0,
          daysRemaining: latest.days_remaining,
        }
      })
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())

    return data
  }, [projections, dateRange])

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const cashValues = chartData.map(d => d.cashAvailable)
    const totalValues = chartData.map(d => d.totalAvailable)
    const cashPerWeekValues = chartData.map(d => d.cashPerWeek).filter(v => v > 0)

    return {
      avgCashAvailable: cashValues.reduce((a, b) => a + b, 0) / cashValues.length,
      maxCashAvailable: Math.max(...cashValues),
      minCashAvailable: Math.min(...cashValues),
      avgTotalAvailable: totalValues.reduce((a, b) => a + b, 0) / totalValues.length,
      avgCashPerWeek: cashPerWeekValues.length > 0 
        ? cashPerWeekValues.reduce((a, b) => a + b, 0) / cashPerWeekValues.length 
        : 0,
    }
  }, [chartData])

  // Custom tooltip formatter
  const formatTooltipValue = useCallback((value: number, name: string) => {
    if (typeof value === 'number') {
      return [formatCurrency(value), name]
    }
    return [value, name]
  }, [])

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

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <div className="glass-small px-4 py-2 rounded-md">
          <p className="glass-text-secondary text-sm">
            Showing <span className="glass-text-primary font-semibold">{chartData.length}</span> data points
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

      {/* Summary Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass-medium">
            <CardContent className="p-4">
              <p className="glass-text-tertiary text-xs mb-1">Avg Cash Available</p>
              <p className="glass-text-primary font-semibold text-lg">
                {formatCurrency(stats.avgCashAvailable)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass-medium">
            <CardContent className="p-4">
              <p className="glass-text-tertiary text-xs mb-1">Max Cash Available</p>
              <p className="glass-text-primary font-semibold text-lg">
                {formatCurrency(stats.maxCashAvailable)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass-medium">
            <CardContent className="p-4">
              <p className="glass-text-tertiary text-xs mb-1">Min Cash Available</p>
              <p className="glass-text-primary font-semibold text-lg">
                {formatCurrency(stats.minCashAvailable)}
              </p>
            </CardContent>
          </Card>
          {stats.avgCashPerWeek > 0 && (
            <Card className="glass-medium">
              <CardContent className="p-4">
                <p className="glass-text-tertiary text-xs mb-1">Avg Cash Per Week</p>
                <p className="glass-text-primary font-semibold text-lg">
                  {formatCurrency(stats.avgCashPerWeek)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cash Flow Over Time */}
      <Card className="glass-large">
        <CardHeader>
          <CardTitle className="glass-text-primary">Cash Flow Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
                formatter={formatTooltipValue}
              />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
              <Area
                type="monotone"
                dataKey="cashAvailable"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorCash)"
                name="Cash Available"
              />
              <Area
                type="monotone"
                dataKey="totalAvailable"
                stroke="#82ca9d"
                fillOpacity={0}
                strokeWidth={2}
                name="Total Available"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Per Week Trend */}
      {chartData.some(d => d.cashPerWeek > 0) && (
        <Card className="glass-large">
          <CardHeader>
            <CardTitle className="glass-text-primary">Weekly Spending Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                  }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
                <Bar dataKey="cashPerWeek" fill="#8884d8" name="Cash Per Week" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Spending Trends */}
      <Card className="glass-large">
        <CardHeader>
          <CardTitle className="glass-text-primary">Daily Spending Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
                formatter={formatTooltipValue}
              />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
              <Line
                type="monotone"
                dataKey="spendingPerDay"
                stroke="#82ca9d"
                strokeWidth={2}
                name="Spending Per Day"
                dot={{ fill: '#82ca9d', r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="billsRemaining"
                stroke="#ffc658"
                strokeWidth={2}
                name="Bills Remaining"
                dot={{ fill: '#ffc658', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

