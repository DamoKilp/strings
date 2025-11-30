'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  getAllProjections, 
  deleteProjection, 
  getAccounts, 
  getSpendTrackingFilterPreferences,
  saveSpendTrackingFilterPreferences,
  type FinanceProjection, 
  type FinanceAccount 
} from '@/app/actions/finance'
import { formatCurrency } from '@/lib/financeUtils'
import { toast } from 'sonner'
import FinanceImportDialog from './FinanceImportDialog'

// New filter/sort system imports
import type {
  ColumnField,
  ColumnFilter,
  FilterState,
  SortState,
  SortDirection,
  ColumnConfig,
  SerializableFilterState,
  SerializableSortState,
} from '@/types/finance/filterTypes'
import {
  createEmptyFilterState,
  createEmptySortState,
  createStaticColumnConfig,
  createAccountColumnConfig,
  serializeFilterState,
  deserializeFilterState,
  serializeSortState,
  deserializeSortState,
} from '@/types/finance/filterTypes'
import {
  applyAllFilters,
  setColumnFilter,
  clearColumnFilter,
  getActiveFilterCount,
} from '@/lib/finance/filterUtils'
import {
  applyCascadingSort,
  addSortRule,
  removeSortRule,
  getSortRule,
} from '@/lib/finance/sortUtils'
import TableHeaderFilterSort from '@/components/finance/TableHeaderFilterSort'

interface HistoricalSpendTrackingTabProps {
  initialProjections?: FinanceProjection[]
}

interface AccountInfo {
  id: string
  name: string
}

interface GroupedProjection {
  yearMonth: string
  year: number
  month: number
  projections: FinanceProjection[]
}

/**
 * Historical Spend Tracking Tab Component
 * Displays all historical projections in table format with Excel-style filtering, 
 * cascading sorting, and date grouping.
 */
export default function HistoricalSpendTrackingTab({ 
  initialProjections = [] 
}: HistoricalSpendTrackingTabProps) {
  const [projections, setProjections] = useState<FinanceProjection[]>(initialProjections)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  
  // Legacy filter state (kept for backward compatibility)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'last12' | 'last6' | 'last3' | 'custom'>('all')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  
  // New filter/sort state
  const [columnFilters, setColumnFilters] = useState<FilterState>(() => createEmptyFilterState())
  const [sortState, setSortState] = useState<SortState>(() => createEmptySortState())
  const [sortMode, setSortMode] = useState<'global' | 'monthly'>('monthly') // 'global' = sort all data, 'monthly' = sort within each month
  
  // Preferences persistence
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ref for height constraint
  const outerContainerRef = useRef<HTMLDivElement>(null)
  
  // Load saved preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const result = await getSpendTrackingFilterPreferences()
        if (result.data) {
          const prefs = result.data
          
          // Restore column filters
          if (prefs.columnFilters) {
            setColumnFilters(deserializeFilterState(prefs.columnFilters as SerializableFilterState))
          }
          
          // Restore sort state
          if (prefs.sortState) {
            setSortState(deserializeSortState(prefs.sortState as SerializableSortState))
          }
          
          // Restore sort mode
          if (prefs.sortMode) {
            setSortMode(prefs.sortMode)
          }
          
          // Restore legacy filters
          if (prefs.searchTerm !== undefined) setSearchTerm(prefs.searchTerm)
          if (prefs.dateFilter !== undefined) setDateFilter(prefs.dateFilter)
          if (prefs.customDateStart !== undefined) setCustomDateStart(prefs.customDateStart)
          if (prefs.customDateEnd !== undefined) setCustomDateEnd(prefs.customDateEnd)
          if (prefs.yearFilter !== undefined) setYearFilter(prefs.yearFilter)
          if (prefs.minAmount !== undefined) setMinAmount(prefs.minAmount)
          if (prefs.maxAmount !== undefined) setMaxAmount(prefs.maxAmount)
          if (prefs.selectedAccounts) {
            setSelectedAccounts(new Set(prefs.selectedAccounts))
          }
        }
      } catch (error) {
        console.error('Failed to load filter preferences:', error)
      } finally {
        setPreferencesLoaded(true)
      }
    }
    
    loadPreferences()
  }, [])
  
  // Save preferences when filters change (debounced)
  useEffect(() => {
    // Don't save until preferences are loaded (to avoid overwriting with defaults)
    if (!preferencesLoaded) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveSpendTrackingFilterPreferences({
          columnFilters: serializeFilterState(columnFilters),
          sortState: serializeSortState(sortState),
          sortMode,
          searchTerm,
          dateFilter,
          customDateStart,
          customDateEnd,
          yearFilter,
          minAmount,
          maxAmount,
          selectedAccounts: Array.from(selectedAccounts),
        })
      } catch (error) {
        console.error('Failed to save filter preferences:', error)
      }
    }, 1000)
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [
    preferencesLoaded,
    columnFilters,
    sortState,
    sortMode,
    searchTerm,
    dateFilter,
    customDateStart,
    customDateEnd,
    yearFilter,
    minAmount,
    maxAmount,
    selectedAccounts,
  ])

  // Extract unique accounts from all historical projections
  const uniqueAccounts = useMemo<AccountInfo[]>(() => {
    const accountMap = new Map<string, string>()
    
    projections.forEach(projection => {
      Object.keys(projection.account_balances || {}).forEach(accountId => {
        if (!accountMap.has(accountId)) {
          const account = accounts.find(a => a.id === accountId)
          accountMap.set(accountId, account?.name || accountId)
        }
      })
    })
    
    return Array.from(accountMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projections, accounts])

  // Build column configurations
  const columnConfigs = useMemo<ColumnConfig[]>(() => {
    const staticColumns: ColumnConfig[] = [
      createStaticColumnConfig('date'),
      createStaticColumnConfig('year'),
      createStaticColumnConfig('time'),
      createStaticColumnConfig('days_remaining'),
    ]
    
    // Add account columns
    const accountColumns = uniqueAccounts.map(acc => 
      createAccountColumnConfig(acc.id, acc.name)
    )
    
    const summaryColumns: ColumnConfig[] = [
      createStaticColumnConfig('total'),
      createStaticColumnConfig('bills_remaining'),
      createStaticColumnConfig('cash_available'),
      createStaticColumnConfig('cash_per_week'),
      createStaticColumnConfig('spending_per_day'),
      createStaticColumnConfig('notes'),
    ]
    
    return [...staticColumns, ...accountColumns, ...summaryColumns]
  }, [uniqueAccounts])

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
      getAccounts().then(result => {
        if (result.data) {
          setAccounts(result.data)
        }
      })
    }
  }, [initialProjections.length, loadData])

  // Apply legacy filters (year, date range, amount, accounts, search)
  const legacyFilteredProjections = useMemo(() => {
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
      
      if (dateFilter === 'custom') {
        if (customDateStart && customDateEnd) {
          const start = new Date(customDateStart)
          const end = new Date(customDateEnd)
          end.setHours(23, 59, 59, 999)
          filtered = filtered.filter(p => {
            const projDate = new Date(p.projection_date)
            return projDate >= start && projDate <= end
          })
        }
      } else {
        const monthsAgo = dateFilter === 'last12' ? 12 : dateFilter === 'last6' ? 6 : 3
        const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
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
          return balance !== 0
        })
      })
    }

    // Apply search filter
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

    return filtered
  }, [projections, yearFilter, dateFilter, customDateStart, customDateEnd, minAmount, maxAmount, selectedAccounts, searchTerm])

  // Apply column filters and sorting
  const filteredAndSortedProjections = useMemo(() => {
    // First apply legacy filters
    let result = legacyFilteredProjections
    
    // Then apply column filters
    result = applyAllFilters(result, columnFilters)
    
    // Finally apply cascading sort
    if (sortState.length > 0) {
      result = applyCascadingSort(result, sortState)
    } else {
      // Default sort by date descending if no sort rules
      result = [...result].sort((a, b) => 
        new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
      )
    }
    
    return result
  }, [legacyFilteredProjections, columnFilters, sortState])

  // Apply filters (without sorting) for monthly mode
  const filteredProjections = useMemo(() => {
    let result = legacyFilteredProjections
    result = applyAllFilters(result, columnFilters)
    return result
  }, [legacyFilteredProjections, columnFilters])

  // Group projections by year/month
  const groupedProjections = useMemo<GroupedProjection[]>(() => {
    const groups = new Map<string, GroupedProjection>()
    
    // Use filtered data (with or without sorting depending on mode)
    const projectionsToGroup = sortMode === 'global' 
      ? filteredAndSortedProjections // Already sorted globally
      : filteredProjections // Filtered but not sorted yet
    
    projectionsToGroup.forEach(projection => {
      const date = new Date(projection.projection_date)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`
      
      if (!groups.has(yearMonth)) {
        groups.set(yearMonth, { yearMonth, year, month, projections: [] })
      }
      groups.get(yearMonth)!.projections.push(projection)
    })
    
    // Sort groups by year/month (newest first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
    
    // If monthly sort mode, sort within each group
    if (sortMode === 'monthly') {
      if (sortState.length > 0) {
        sortedGroups.forEach(group => {
          group.projections = applyCascadingSort(group.projections, sortState)
        })
      } else {
        // Default sort by date descending within each month
        sortedGroups.forEach(group => {
          group.projections.sort((a, b) => 
            new Date(b.projection_date).getTime() - new Date(a.projection_date).getTime()
          )
        })
      }
    }
    // If global mode, projections are already sorted in filteredAndSortedProjections
    
    return sortedGroups
  }, [filteredAndSortedProjections, filteredProjections, sortMode, sortState])

  // Calculate summary statistics for filtered projections
  const summaryStats = useMemo(() => {
    const count = filteredAndSortedProjections.length
    if (count === 0) {
      return null
    }

    // Helper to calculate stats for a numeric array
    const calcStats = (values: number[]) => {
      if (values.length === 0) return { sum: 0, avg: 0, min: 0, max: 0 }
      const sum = values.reduce((a, b) => a + b, 0)
      const avg = sum / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      return { sum, avg, min, max }
    }

    // Extract values for each column
    const daysRemainingValues = filteredAndSortedProjections.map(p => p.days_remaining)
    const totalValues = filteredAndSortedProjections.map(p => 
      Object.values(p.account_balances || {}).reduce((sum, val) => sum + val, 0)
    )
    const billsRemainingValues = filteredAndSortedProjections.map(p => p.bills_remaining)
    const cashAvailableValues = filteredAndSortedProjections.map(p => p.cash_available)
    const cashPerWeekValues = filteredAndSortedProjections
      .map(p => {
        // If less than 7 days remaining, cash per week equals total cash available
        if (p.days_remaining < 7) {
          return p.cash_available
        }
        const weeksRemaining = p.days_remaining > 0 ? p.days_remaining / 7 : 0
        return weeksRemaining > 0 ? (p.cash_per_week ?? p.cash_available / weeksRemaining) : 0
      })
      .filter(v => v > 0)
    const spendingPerDayValues = filteredAndSortedProjections
      .map(p => {
        return p.days_remaining > 0 ? (p.spending_per_day ?? p.cash_available / p.days_remaining) : 0
      })
      .filter(v => v > 0)

    // Calculate stats for account columns
    const accountStats: Record<string, { sum: number; avg: number; min: number; max: number }> = {}
    uniqueAccounts.forEach(account => {
      const values = filteredAndSortedProjections.map(p => p.account_balances[account.id] || 0)
      accountStats[account.id] = calcStats(values)
    })

    // Calculate derived column stats
    const leftOver450Values = filteredAndSortedProjections.map(p => {
      const weeksRemaining = p.days_remaining > 0 ? p.days_remaining / 7 : 0
      return p.cash_available - (450 * weeksRemaining)
    })
    const minNeededValues = filteredAndSortedProjections.map(p => {
      const weeksRemaining = p.days_remaining > 0 ? p.days_remaining / 7 : 0
      return p.bills_remaining + (450 * weeksRemaining)
    })

    return {
      count,
      daysRemaining: calcStats(daysRemainingValues),
      total: calcStats(totalValues),
      billsRemaining: calcStats(billsRemainingValues),
      cashAvailable: calcStats(cashAvailableValues),
      cashPerWeek: calcStats(cashPerWeekValues),
      spendingPerDay: calcStats(spendingPerDayValues),
      accounts: accountStats,
      leftOver450: calcStats(leftOver450Values),
      minNeeded: calcStats(minNeededValues),
    }
  }, [filteredAndSortedProjections, uniqueAccounts])

  // Handle column filter change
  const handleFilterChange = useCallback((field: ColumnField, filter: ColumnFilter | null) => {
    setColumnFilters(prev => {
      if (filter === null) {
        return clearColumnFilter(prev, field)
      }
      return setColumnFilter(prev, field, filter)
    })
  }, [])

  // Handle column sort change
  const handleSortChange = useCallback((field: ColumnField, direction: SortDirection | null) => {
    setSortState(prev => {
      if (direction === null) {
        return removeSortRule(prev, field)
      }
      return addSortRule(prev, field, direction)
    })
  }, [])

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
    // If less than 7 days remaining, cash per week equals total cash available
    const cashPerWeek = projection.days_remaining < 7 
      ? cashAvailable 
      : (weeksRemaining > 0 ? (projection.cash_per_week || cashAvailable / weeksRemaining) : 0)
    const leftOver450PerWeek = cashAvailable - (450 * weeksRemaining)
    const minAmountNeeded = projection.bills_remaining + (450 * weeksRemaining)
    const spendingPerDay = projection.days_remaining > 0 ? (projection.spending_per_day || cashAvailable / projection.days_remaining) : 0
    
    return { total, cashAvailable, weeksRemaining, cashPerWeek, leftOver450PerWeek, minAmountNeeded, spendingPerDay }
  }, [])

  // Handle import completion
  const handleImportComplete = useCallback(async () => {
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

  // Get active filter count for display
  const activeColumnFilterCount = getActiveFilterCount(columnFilters)

  // Helper to get column config by field
  const getColumnConfig = useCallback((field: ColumnField): ColumnConfig | undefined => {
    return columnConfigs.find(c => c.field === field)
  }, [columnConfigs])

  // Constrain height to viewport, accounting for any parent padding/margins
  useEffect(() => {
    const constrainHeight = () => {
      if (outerContainerRef.current) {
        const outer = outerContainerRef.current
        const parent = outer.parentElement
        if (parent) {
          // Get the parent's position relative to viewport
          const parentRect = parent.getBoundingClientRect()
          const viewportHeight = window.innerHeight
          
          // Calculate available height: viewport height minus parent's top offset
          // This accounts for any headers, padding, etc. above the parent
          const availableHeight = viewportHeight - parentRect.top
          
          // Use available viewport space, but ensure minimum of 400px
          const maxHeight = Math.max(availableHeight - 20, 400) // -20 for some padding
          
          outer.style.height = `${maxHeight}px`
          outer.style.maxHeight = `${maxHeight}px`
        }
      }
    }

    constrainHeight()
    window.addEventListener('resize', constrainHeight)
    
    // Also constrain after a short delay to catch layout shifts
    const timeout = setTimeout(constrainHeight, 100)
    
    return () => {
      window.removeEventListener('resize', constrainHeight)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div 
      ref={outerContainerRef}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Container for Header, Table, and Footer */}
      <div 
        className="glass-large rounded-lg h-full max-h-full flex flex-col overflow-hidden"
      >
        {/* Header with Import/Export Buttons */}
        <div className="flex items-center justify-between shrink-0 p-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="glass-text-primary text-lg font-semibold">Historical Spend Tracking</h2>
            {/* Filter/Sort Status */}
            <div className="flex items-center gap-2">
              {activeColumnFilterCount > 0 && (
                <button
                  onClick={() => setColumnFilters(createEmptyFilterState())}
                  className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded hover:bg-amber-500/30 transition-colors"
                >
                  {activeColumnFilterCount} filter{activeColumnFilterCount > 1 ? 's' : ''} ✕
                </button>
              )}
              {sortState.length > 0 && (
                <button
                  onClick={() => setSortState(createEmptySortState())}
                  className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/30 transition-colors"
                >
                  {sortState.length} sort{sortState.length > 1 ? 's' : ''} ✕
                </button>
              )}
              {/* Sort Mode Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSortMode(prev => prev === 'global' ? 'monthly' : 'global')
                }}
                className={`text-xs px-2 py-0.5 rounded transition-all cursor-pointer ${
                  sortMode === 'global' 
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50 font-medium' 
                    : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                }`}
                title={
                  sortMode === 'global' 
                    ? 'Sorting globally across all data. Click to sort within each month. Apply a column sort to see the difference!' 
                    : 'Sorting within each month. Click to sort globally across all data. Apply a column sort to see the difference!'
                }
              >
                <span className="inline-flex items-center gap-1">
                  {sortMode === 'global' ? '🌐 Global' : '📅 Monthly'}
                  {sortState.length === 0 && (
                    <span className="text-[10px] opacity-60" title="Apply a column sort to see the difference between modes">
                      ⚠️
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
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

        {/* Table */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="glass-text-secondary">Loading historical projections...</p>
          </div>
        ) : filteredAndSortedProjections.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="glass-text-secondary">
              {projections.length === 0 
                ? 'No historical projections found. Start tracking your spending to see data here.' 
                : 'No projections match your filters.'}
            </p>
          </div>
        ) : (
          <div 
            className="flex-1 min-h-0 overflow-auto"
          >
          <table className="w-full text-xs min-w-[800px]">
            <thead className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
              <tr className="border-b border-white/10 dark:border-white/10">
                {/* Date - Sticky horizontally */}
                <th className="text-center py-2 px-1.5 glass-text-secondary text-xs font-medium sticky left-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-30 border-r border-white/10 dark:border-white/10">
                  {getColumnConfig('date') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('date')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('date') ?? null}
                      currentSort={getSortRule(sortState, 'date')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Year */}
                <th className="text-center py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  {getColumnConfig('year') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('year')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('year') ?? null}
                      currentSort={getSortRule(sortState, 'year')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Time */}
                <th className="text-center py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  {getColumnConfig('time') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('time')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('time') ?? null}
                      currentSort={getSortRule(sortState, 'time')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Days Remaining */}
                <th className="text-center py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  {getColumnConfig('days_remaining') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('days_remaining')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('days_remaining') ?? null}
                      currentSort={getSortRule(sortState, 'days_remaining')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Account Columns */}
                {uniqueAccounts.map(account => {
                  const field = `account_${account.id}` as ColumnField
                  const config = getColumnConfig(field)
                  return (
                    <th key={account.id} className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                      {config ? (
                        <TableHeaderFilterSort
                          column={config}
                          projections={legacyFilteredProjections}
                          currentFilter={columnFilters.get(field) ?? null}
                          currentSort={getSortRule(sortState, field)}
                          onFilterChange={handleFilterChange}
                          onSortChange={handleSortChange}
                        />
                      ) : account.name}
                    </th>
                  )
                })}
                {/* Total */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-blue-100/80 dark:bg-blue-900/30">
                  {getColumnConfig('total') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('total')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('total') ?? null}
                      currentSort={getSortRule(sortState, 'total')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Bills Remaining */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-blue-100/80 dark:bg-blue-900/30">
                  {getColumnConfig('bills_remaining') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('bills_remaining')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('bills_remaining') ?? null}
                      currentSort={getSortRule(sortState, 'bills_remaining')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Cash Available */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-blue-100/80 dark:bg-blue-900/30">
                  {getColumnConfig('cash_available') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('cash_available')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('cash_available') ?? null}
                      currentSort={getSortRule(sortState, 'cash_available')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Cash per Week */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-blue-100/80 dark:bg-blue-900/30">
                  {getColumnConfig('cash_per_week') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('cash_per_week')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('cash_per_week') ?? null}
                      currentSort={getSortRule(sortState, 'cash_per_week')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Non-sortable columns */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  Left Over (450/wk)
                </th>
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  Min Needed
                </th>
                {/* Spending per Day */}
                <th className="text-right py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  {getColumnConfig('spending_per_day') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('spending_per_day')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('spending_per_day') ?? null}
                      currentSort={getSortRule(sortState, 'spending_per_day')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                {/* Notes */}
                <th className="text-left py-2 px-1.5 glass-text-secondary text-xs font-medium bg-white/95 dark:bg-slate-900/95">
                  {getColumnConfig('notes') && (
                    <TableHeaderFilterSort
                      column={getColumnConfig('notes')!}
                      projections={legacyFilteredProjections}
                      currentFilter={columnFilters.get('notes') ?? null}
                      currentSort={getSortRule(sortState, 'notes')}
                      onFilterChange={handleFilterChange}
                      onSortChange={handleSortChange}
                    />
                  )}
                </th>
                <th className="text-center py-2 px-1.5 glass-text-secondary text-xs font-medium w-10 bg-white/95 dark:bg-slate-900/95">Delete</th>
              </tr>
            </thead>
            <tbody>
                    {groupedProjections.map((group) => (
                      <React.Fragment key={`${group.yearMonth}-${sortMode}-${sortState.length > 0 ? sortState.map(s => `${s.field}-${s.direction}`).join('-') : 'default'}`}>
                        {/* Month/Year Header Row */}
                        <tr className="bg-white/10 dark:bg-white/5 border-b border-white/20 dark:border-white/10">
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
                            <tr key={projection.id} className="border-b border-white/10 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-colors">
                              {/* Date */}
                              <td className="py-1 px-1.5 text-center glass-text-primary text-xs sticky left-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 border-r border-white/10 dark:border-white/10">
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
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/15 dark:bg-white/5">
                                {formatCurrency(values.total)}
                              </td>
                              {/* Bills Remaining */}
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-semibold bg-white/15 dark:bg-white/5">
                                {formatCurrency(projection.bills_remaining)}
                              </td>
                              {/* Cash Available */}
                              <td className="py-1 px-1.5 text-right glass-text-primary text-xs font-bold bg-white/15 dark:bg-white/5">
                                {formatCurrency(values.cashAvailable)}
                              </td>
                              {/* Cash per week */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs bg-white/15 dark:bg-white/5">
                                {formatCurrency(values.cashPerWeek)}
                              </td>
                              {/* Left Over */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
                                {formatCurrency(values.leftOver450PerWeek)}
                              </td>
                              {/* Min amount needed */}
                              <td className="py-1 px-1.5 text-right glass-text-secondary text-xs">
                                {formatCurrency(values.minAmountNeeded)}
                              </td>
                              {/* Spending per day */}
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
                  {/* Summary Statistics Footer */}
                  {summaryStats && (
                    <tfoot className="border-t-2 border-white/30 dark:border-white/20">
                      {/* SUM Row */}
                      <tr className="bg-emerald-500/10 dark:bg-emerald-500/5">
                        <td className="py-1.5 px-1.5 text-center font-bold text-emerald-600 dark:text-emerald-400 text-xs sticky left-0 bg-emerald-500/20 dark:bg-emerald-500/10 backdrop-blur-sm z-10 border-r border-white/10">
                          SUM
                        </td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {summaryStats.daysRemaining.sum.toLocaleString()}
                        </td>
                        {uniqueAccounts.map(account => (
                          <td key={account.id} className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(summaryStats.accounts[account.id]?.sum || 0)}
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.total.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.billsRemaining.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashAvailable.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashPerWeek.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(summaryStats.leftOver450.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(summaryStats.minNeeded.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(summaryStats.spendingPerDay.sum)}
                        </td>
                        <td className="py-1.5 px-1.5 text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                      </tr>
                      {/* AVG Row */}
                      <tr className="bg-blue-500/10 dark:bg-blue-500/5">
                        <td className="py-1.5 px-1.5 text-center font-bold text-blue-600 dark:text-blue-400 text-xs sticky left-0 bg-blue-500/20 dark:bg-blue-500/10 backdrop-blur-sm z-10 border-r border-white/10">
                          AVG
                        </td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs font-medium text-blue-600 dark:text-blue-400">
                          {summaryStats.daysRemaining.avg.toFixed(1)}
                        </td>
                        {uniqueAccounts.map(account => (
                          <td key={account.id} className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400">
                            {formatCurrency(summaryStats.accounts[account.id]?.avg || 0)}
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-blue-600 dark:text-blue-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.total.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.billsRemaining.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-blue-600 dark:text-blue-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashAvailable.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashPerWeek.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(summaryStats.leftOver450.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(summaryStats.minNeeded.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(summaryStats.spendingPerDay.avg)}
                        </td>
                        <td className="py-1.5 px-1.5 text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                      </tr>
                      {/* MAX Row */}
                      <tr className="bg-amber-500/10 dark:bg-amber-500/5">
                        <td className="py-1.5 px-1.5 text-center font-bold text-amber-600 dark:text-amber-400 text-xs sticky left-0 bg-amber-500/20 dark:bg-amber-500/10 backdrop-blur-sm z-10 border-r border-white/10">
                          MAX
                        </td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                          {summaryStats.daysRemaining.max.toLocaleString()}
                        </td>
                        {uniqueAccounts.map(account => (
                          <td key={account.id} className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400">
                            {formatCurrency(summaryStats.accounts[account.id]?.max || 0)}
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-amber-600 dark:text-amber-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.total.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.billsRemaining.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-amber-600 dark:text-amber-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashAvailable.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashPerWeek.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(summaryStats.leftOver450.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(summaryStats.minNeeded.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(summaryStats.spendingPerDay.max)}
                        </td>
                        <td className="py-1.5 px-1.5 text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                      </tr>
                      {/* MIN Row */}
                      <tr className="bg-purple-500/10 dark:bg-purple-500/5">
                        <td className="py-1.5 px-1.5 text-center font-bold text-purple-600 dark:text-purple-400 text-xs sticky left-0 bg-purple-500/20 dark:bg-purple-500/10 backdrop-blur-sm z-10 border-r border-white/10">
                          MIN
                        </td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs font-medium text-purple-600 dark:text-purple-400">
                          {summaryStats.daysRemaining.min.toLocaleString()}
                        </td>
                        {uniqueAccounts.map(account => (
                          <td key={account.id} className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400">
                            {formatCurrency(summaryStats.accounts[account.id]?.min || 0)}
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-purple-600 dark:text-purple-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.total.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.billsRemaining.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-bold text-purple-600 dark:text-purple-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashAvailable.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400 bg-white/15 dark:bg-white/5">
                          {formatCurrency(summaryStats.cashPerWeek.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400">
                          {formatCurrency(summaryStats.leftOver450.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400">
                          {formatCurrency(summaryStats.minNeeded.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-xs font-medium text-purple-600 dark:text-purple-400">
                          {formatCurrency(summaryStats.spendingPerDay.min)}
                        </td>
                        <td className="py-1.5 px-1.5 text-xs glass-text-secondary">—</td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                      </tr>
                      {/* Count Row */}
                      <tr className="bg-slate-500/10 dark:bg-slate-500/5 border-t border-white/20">
                        <td className="py-1.5 px-1.5 text-center font-bold glass-text-primary text-xs sticky left-0 bg-slate-500/20 dark:bg-slate-500/10 backdrop-blur-sm z-10 border-r border-white/10">
                          COUNT
                        </td>
                        <td colSpan={3 + uniqueAccounts.length + 10} className="py-1.5 px-1.5 text-xs glass-text-primary font-medium">
                          {summaryStats.count.toLocaleString()} rows
                        </td>
                        <td className="py-1.5 px-1.5 text-center text-xs glass-text-secondary">—</td>
                      </tr>
            </tfoot>
          )}
          </table>
        </div>
        )}

        {/* Footer with Item Count */}
        <div className="shrink-0 px-4 py-2 border-t border-white/10 dark:border-white/10 bg-white/5 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs glass-text-secondary">
              Showing <span className="font-medium glass-text-primary">{filteredAndSortedProjections.length}</span> of <span className="font-medium glass-text-primary">{projections.length}</span> items
            </span>
          </div>
        </div>
      </div>

      {/* Import Dialog */}
      <FinanceImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}
