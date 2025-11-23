'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { getAllProjections, deleteProjection, getAccounts, type FinanceProjection, type FinanceAccount } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/financeUtils'
import { toast } from 'sonner'
import FinanceImportDialog from './FinanceImportDialog'

interface HistoricalSpendTrackingTabProps {
  initialProjections?: FinanceProjection[]
}

interface AccountInfo {
  id: string
  name: string
}

type SortField = 'date' | 'time' | 'days_remaining' | 'total' | 'bills_remaining' | 'cash_available' | 'cash_per_week' | 'spending_per_day'
type SortDirection = 'asc' | 'desc'

interface GroupedProjection {
  yearMonth: string
  year: number
  month: number
  projections: FinanceProjection[]
}

/**
 * Historical Spend Tracking Tab Component
 * Displays all historical projections in table format with filtering, sorting, and date grouping
 */
export default function HistoricalSpendTrackingTab({ 
  initialProjections = [] 
}: HistoricalSpendTrackingTabProps) {
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'last12' | 'last6' | 'last3' | 'custom'>('all')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  // Extract unique accounts from all historical projections
  const uniqueAccounts = useMemo<AccountInfo[]>(() => {
    const accountMap = new Map<string, string>()
    
    projections.forEach(projection => {
      Object.keys(projection.account_balances || {}).forEach(accountId => {
        if (!accountMap.has(accountId)) {
          // Try to find account name from current accounts, fall back to ID
          const account = accounts.find(a => a.id === accountId)
          accountMap.set(accountId, account?.name || accountId)
        }
      })
    })
    
    // Convert to array and sort by name for better UX
    return Array.from(accountMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projections, accounts])

  // Load all historical projections and accounts
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [projectionsResult, accountsResult] = await Promise.all([
        getAllProjections(),
        getAccounts()
      ])
      
      if (projectionsResult.error) {
        toast.error(`Failed to load projections: ${projectionsResult.error}`)
      } else if (projectionsResult.data) {
        setProjections(projectionsResult.data)
      }
      
      if (accountsResult.error) {
        console.error('Failed to load accounts:', accountsResult.error)
      } else if (accountsResult.data) {
        setAccounts(accountsResult.data)
      }
    } catch (error) {
      toast.error('Failed to load historical data')
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load data on mount if not provided
  useEffect(() => {
    if (initialProjections.length === 0) {
      loadData()
    } else {
      // Still load accounts to get proper names
      getAccounts().then(result => {
        if (result.data) {
          setAccounts(result.data)
        }
      })
    }
  }, [initialProjections.length, loadData])

  // Extract available years from projections
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    projections.forEach(p => {
      const year = new Date(p.projection_date).getFullYear()
      years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a) // Descending order
  }, [projections])

  // Filter and sort projections
  const filteredAndSortedProjections = useMemo(() => {
    let filtered = [...projections]

    // Apply year filter
    if (yearFilter !== 'all') {
      const year = parseInt(yearFilter)
      if (!isNaN(year)) {
        filtered = filtered.filter(p => {
          const projYear = new Date(p.projection_date).getFullYear()
          return projYear === year
        })
      }
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let cutoffDate: Date
      
      if (dateFilter === 'custom') {
        if (customDateStart && customDateEnd) {
          const start = new Date(customDateStart)
          const end = new Date(customDateEnd)
          end.setHours(23, 59, 59, 999) // Include entire end date
          filtered = filtered.filter(p => {
            const projDate = new Date(p.projection_date)
            return projDate >= start && projDate <= end
          })
        } else {
          return filtered // If custom dates not set, show all
        }
      } else {
        const monthsAgo = dateFilter === 'last12' ? 12 : dateFilter === 'last6' ? 6 : 3
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
        filtered = filtered.filter(p => new Date(p.projection_date) >= cutoffDate)
      }
    }

    // Apply amount filters
    if (minAmount) {
      const min = parseFloat(minAmount)
      if (!isNaN(min)) {
        filtered = filtered.filter(p => p.cash_available >= min)
      }
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount)
      if (!isNaN(max)) {
        filtered = filtered.filter(p => p.cash_available <= max)
      }
    }

    // Apply account filter
    if (selectedAccounts.size > 0) {
      filtered = filtered.filter(p => {
        return Array.from(selectedAccounts).some(accountId => {
          const balance = p.account_balances[accountId] || 0
          return balance !== 0 // Has non-zero balance in selected account
        })
      })
    }

    // Apply search filter (search in notes, date, or amounts)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.notes?.toLowerCase().includes(searchLower) ||
        p.projection_date.includes(searchLower) ||
        p.cash_available.toString().includes(searchLower) ||
        p.total_available.toString().includes(searchLower) ||
        p.entry_time?.includes(searchLower)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'date':
          comparison = new Date(a.projection_date).getTime() - new Date(b.projection_date).getTime()
          break
        case 'time':
          const timeA = a.entry_time || '00:00:00'
          const timeB = b.entry_time || '00:00:00'
          comparison = timeA.localeCompare(timeB)
          break
        case 'days_remaining':
          comparison = a.days_remaining - b.days_remaining
          break
        case 'total':
          comparison = a.total_available - b.total_available
          break
        case 'bills_remaining':
          comparison = a.bills_remaining - b.bills_remaining
          break
        case 'cash_available':
          comparison = a.cash_available - b.cash_available
          break
        case 'cash_per_week':
          const cashPerWeekA = a.cash_per_week || 0
          const cashPerWeekB = b.cash_per_week || 0
          comparison = cashPerWeekA - cashPerWeekB
          break
        case 'spending_per_day':
          const spendingPerDayA = a.spending_per_day || 0
          const spendingPerDayB = b.spending_per_day || 0
          comparison = spendingPerDayA - spendingPerDayB
          break
        default:
          return 0
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [projections, yearFilter, dateFilter, customDateStart, customDateEnd, minAmount, maxAmount, selectedAccounts, searchTerm, sortField, sortDirection])

  // Group projections by year/month
  const groupedProjections = useMemo<GroupedProjection[]>(() => {
    const groups = new Map<string, GroupedProjection>()
    
    filteredAndSortedProjections.forEach(projection => {
      const date = new Date(projection.projection_date)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`
      
      if (!groups.has(yearMonth)) {
        groups.set(yearMonth, {
          yearMonth,
          year,
          month,
          projections: []
        })
      }
      
      groups.get(yearMonth)!.projections.push(projection)
    })
    
    // Convert to array and sort by year/month descending (newest first)
    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }, [filteredAndSortedProjections])

  // Handle delete projection
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this projection?')) {
      return
    }
    
    const result = await deleteProjection(id)
    if (result.error) {
      toast.error(`Failed to delete: ${result.error}`)
    } else {
      setProjections(prev => prev.filter(p => p.id !== id))
      toast.success('Projection deleted')
    }
  }, [])

  // Toggle account filter
  const toggleAccountFilter = useCallback((accountId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }, [])

  // Handle sort column click
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField])

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }, [])

  // Format month/year header
  const formatMonthYear = useCallback((year: number, month: number) => {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    })
  }, [])

  // Calculate derived values for a projection
  const calculateProjectionValues = useCallback((projection: FinanceProjection) => {
    const total = Object.values(projection.account_balances || {}).reduce((sum, val) => sum + val, 0)
    const cashAvailable = projection.cash_available
    const weeksRemaining = projection.days_remaining > 0 ? projection.days_remaining / 7 : 0
    const cashPerWeek = weeksRemaining > 0 ? (projection.cash_per_week || cashAvailable / weeksRemaining) : 0
    const leftOver450PerWeek = cashAvailable - (450 * weeksRemaining)
    const minAmountNeeded = projection.bills_remaining + (450 * weeksRemaining)
    const spendingPerDay = projection.days_remaining > 0 ? (projection.spending_per_day || cashAvailable / projection.days_remaining) : 0
    
    return {
      total,
      cashAvailable,
      weeksRemaining,
      cashPerWeek,
      leftOver450PerWeek,
      minAmountNeeded,
      spendingPerDay
    }
  }, [])

  // Handle import completion
  const handleImportComplete = useCallback(async () => {
    // Reload projections after import
    setIsLoading(true)
    try {
      const result = await getAllProjections()
      if (result.error) {
        toast.error(`Failed to reload projections: ${result.error}`)
      } else if (result.data) {
        setProjections(result.data)
      }
    } catch (error) {
      console.error('Error reloading projections:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header with Import/Export Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="glass-text-primary text-lg font-semibold">Historical Spend Tracking</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/api/finance/import/template'
              link.download = 'finance-import-template.xlsx'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              toast.success('Template download started')
            }}
            variant="outline"
            className="glass-small"
            size="sm"
          >
            📥 Download Template
          </Button>
          <Button
            onClick={() => setIsImportDialogOpen(true)}
            className="glass-small"
            size="sm"
          >
            Import from Excel
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="glass-large">
        <CardHeader className="py-2">
          <CardTitle className="glass-text-primary text-sm font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search by date, notes, time, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-small"
            />
          </div>
          
          {/* Year and Date Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-[120px] glass-small">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as typeof dateFilter)}>
              <SelectTrigger className="w-full sm:w-[160px] glass-small">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last12">Last 12 Months</SelectItem>
                <SelectItem value="last6">Last 6 Months</SelectItem>
                <SelectItem value="last3">Last 3 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            
            {dateFilter === 'custom' && (
              <>
                <Input
                  type="date"
                  placeholder="Start date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  className="glass-small flex-1"
                />
                <Input
                  type="date"
                  placeholder="End date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  className="glass-small flex-1"
                />
              </>
            )}
          </div>

          {/* Amount Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="number"
              placeholder="Min cash available"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="glass-small flex-1"
            />
            <Input
              type="number"
              placeholder="Max cash available"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="glass-small flex-1"
            />
          </div>

          {/* Account Filter */}
          {uniqueAccounts.length > 0 && (
            <div className="space-y-2">
              <label className="glass-text-secondary text-xs font-medium">Filter by Accounts:</label>
              <div className="flex flex-wrap gap-2">
                {uniqueAccounts.map(account => (
                  <div key={account.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={selectedAccounts.has(account.id)}
                      onCheckedChange={() => toggleAccountFilter(account.id)}
                    />
                    <label
                      htmlFor={`account-${account.id}`}
                      className="glass-text-secondary text-xs cursor-pointer"
                    >
                      {account.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-full sm:w-[180px] glass-small">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="days_remaining">Days Remaining</SelectItem>
                <SelectItem value="total">Total Available</SelectItem>
                <SelectItem value="bills_remaining">Bills Remaining</SelectItem>
                <SelectItem value="cash_available">Cash Available</SelectItem>
                <SelectItem value="cash_per_week">Cash per Week</SelectItem>
                <SelectItem value="spending_per_day">Spending per Day</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as SortDirection)}>
              <SelectTrigger className="w-full sm:w-[120px] glass-small">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="glass-small px-4 py-2 rounded-md">
        <p className="glass-text-secondary text-sm">
          Showing <span className="glass-text-primary font-semibold">{filteredAndSortedProjections.length}</span> of{' '}
          <span className="glass-text-primary font-semibold">{projections.length}</span> projections
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="glass-large">
          <CardContent className="py-8 text-center">
            <p className="glass-text-secondary">Loading historical projections...</p>
          </CardContent>
        </Card>
      ) : filteredAndSortedProjections.length === 0 ? (
        <Card className="glass-large">
          <CardContent className="py-8 text-center">
            <p className="glass-text-secondary">
              {projections.length === 0 
                ? 'No historical projections found. Start tracking your spending to see data here.' 
                : 'No projections match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <Card className="glass-large">
            <CardContent className="py-1">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium sticky left-0 bg-slate-900/95 z-10">
                        <button
                          onClick={() => handleSort('date')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Date
                          {sortField === 'date' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        Year
                      </th>
                      <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        <button
                          onClick={() => handleSort('time')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Time
                          {sortField === 'time' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        <button
                          onClick={() => handleSort('days_remaining')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Days Remaining
                          {sortField === 'days_remaining' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      {uniqueAccounts.map(account => (
                        <th key={account.id} className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium">
                          {account.name}
                        </th>
                      ))}
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10">
                        <button
                          onClick={() => handleSort('total')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Total
                          {sortField === 'total' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10">
                        <button
                          onClick={() => handleSort('bills_remaining')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Bills Remaining
                          {sortField === 'bills_remaining' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10">
                        <button
                          onClick={() => handleSort('cash_available')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Cash Available
                          {sortField === 'cash_available' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium bg-white/10">
                        <button
                          onClick={() => handleSort('cash_per_week')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Cash per Week
                          {sortField === 'cash_per_week' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        Left Over if only spend 450 per week
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        Min amount needed
                      </th>
                      <th className="text-right py-1 px-1.5 glass-text-secondary text-xs font-medium">
                        <button
                          onClick={() => handleSort('spending_per_day')}
                          className="hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                        >
                          Spending per Day
                          {sortField === 'spending_per_day' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1 px-1.5 glass-text-secondary text-xs font-medium">Notes</th>
                      <th className="text-center py-1 px-1.5 glass-text-secondary text-xs font-medium w-10">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProjections.map((group) => (
                      <React.Fragment key={group.yearMonth}>
                        {/* Month/Year Header Row */}
                        <tr className="bg-white/5 border-b border-white/10">
                          <td 
                            colSpan={5 + uniqueAccounts.length + 9} 
                            className="py-2 px-3 glass-text-primary font-semibold text-sm"
                          >
                            {formatMonthYear(group.year, group.month)}
                          </td>
                        </tr>
                        {/* Projection Rows */}
                        {group.projections.map((projection) => {
                          const values = calculateProjectionValues(projection)
                          const projectionYear = new Date(projection.projection_date).getFullYear()
                          return (
                            <tr key={projection.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              {/* Date */}
                              <td className="py-1 px-1.5 text-center glass-text-primary text-xs sticky left-0 bg-slate-900/95 z-10">
                                {formatDate(projection.projection_date)}
                              </td>
                              
                              {/* Year */}
                              <td className="py-1 px-1.5 text-center glass-text-primary text-xs">
                                {projectionYear}
                              </td>
                              
                              {/* Time */}
                              <td className="py-1 px-1.5 text-center glass-text-primary text-xs">
                                {projection.entry_time ? projection.entry_time.substring(0, 5) : '—'}
                              </td>
                              
                              {/* Days Remaining */}
                              <td className="py-1 px-1.5 text-center glass-text-primary text-xs">
                                {projection.days_remaining}
                              </td>
                              
                              {/* Account Balance Columns */}
                              {uniqueAccounts.map(account => (
                                <td key={account.id} className="py-1 px-1.5 text-right glass-text-primary text-xs">
                                  {formatCurrency(projection.account_balances[account.id] || 0)}
                                </td>
                              ))}
                              
                              {/* Total */}
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/5">
                                {formatCurrency(values.total)}
                              </td>
                              
                              {/* Bills Remaining */}
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-semibold bg-white/5">
                                {formatCurrency(projection.bills_remaining)}
                              </td>
                              
                              {/* Cash Available */}
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/5">
                                {formatCurrency(values.cashAvailable)}
                              </td>
                              
                              {/* Cash per week */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs bg-white/5">
                                {formatCurrency(values.cashPerWeek)}
                              </td>
                              
                              {/* Left Over if only spend 450 per week */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
                                {formatCurrency(values.leftOver450PerWeek)}
                              </td>
                              
                              {/* Min amount needed */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
                                {formatCurrency(values.minAmountNeeded)}
                              </td>
                              
                              {/* Spending available per day */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
                                {formatCurrency(values.spendingPerDay)}
                              </td>
                              
                              {/* Notes */}
                              <td className="py-1 px-1.5 glass-text-secondary text-xs truncate max-w-[100px]" title={projection.notes || ''}>
                                {projection.notes || '—'}
                              </td>
                              
                              {/* Delete Button */}
                              <td className="py-1 px-1.5 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="glass-small h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(projection.id)
                                  }}
                                  title="Delete row"
                                >
                                  ×
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Dialog */}
      <FinanceImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}
