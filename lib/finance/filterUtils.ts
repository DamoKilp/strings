/**
 * Filter Utilities for Historical Spend Tracking
 * 
 * Provides functions for extracting unique column values, applying filters,
 * and managing filter state for the Excel-style filter dropdown.
 * 
 * @module lib/finance/filterUtils
 */

import type { FinanceProjection } from '@/app/actions/finance'
import type {
  ColumnField,
  ColumnFilter,
  FilterState,
  UniqueValuesResult,
  TextFilterOperator,
} from '@/types/finance/filterTypes'
import {
  isAccountColumn,
  getAccountId,
  isValueFilter,
  isTextFilter,
  createEmptyFilterState,
} from '@/types/finance/filterTypes'

// =============================================================================
// VALUE EXTRACTION
// =============================================================================

/**
 * Get the raw value from a projection for a given column field
 * Returns the value as-is (number, string, null, etc.)
 */
export function getColumnValue(
  projection: FinanceProjection,
  field: ColumnField
): string | number | null {
  if (isAccountColumn(field)) {
    const accountId = getAccountId(field)
    return projection.account_balances[accountId] ?? null
  }

  switch (field) {
    case 'date':
      return projection.projection_date
    case 'year':
      // Derived: extract year from projection_date
      return new Date(projection.projection_date).getFullYear()
    case 'time':
      return projection.entry_time
    case 'days_remaining':
      return projection.days_remaining
    case 'total':
      return projection.total_available
    case 'bills_remaining':
      return projection.bills_remaining
    case 'cash_available':
      return projection.cash_available
    case 'cash_per_week':
      return projection.cash_per_week
    case 'spending_per_day':
      return projection.spending_per_day
    case 'notes':
      return projection.notes
    default:
      // Type safety: ensure all cases are handled
      const _exhaustive: never = field
      return null
  }
}

/**
 * Convert a column value to a display string for filter dropdown
 * Handles formatting of dates, numbers, currencies
 */
export function formatValueForDisplay(
  value: string | number | null,
  field: ColumnField
): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Handle different field types
  switch (field) {
    case 'date':
      // Format as locale date string
      if (typeof value === 'string') {
        const date = new Date(value)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      }
      return String(value)

    case 'time':
      // Format time (HH:MM:SS -> HH:MM)
      if (typeof value === 'string') {
        return value.substring(0, 5)
      }
      return String(value)

    case 'year':
    case 'days_remaining':
      // Plain number
      return String(value)

    case 'total':
    case 'bills_remaining':
    case 'cash_available':
    case 'cash_per_week':
    case 'spending_per_day':
      // Currency format
      if (typeof value === 'number') {
        return new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD',
          minimumFractionDigits: 2,
        }).format(value)
      }
      return String(value)

    case 'notes':
      return String(value)

    default:
      // Account columns - currency format
      if (isAccountColumn(field) && typeof value === 'number') {
        return new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD',
          minimumFractionDigits: 2,
        }).format(value)
      }
      return String(value)
  }
}

/**
 * Convert a column value to a string for filter comparison
 * Uses consistent string representation for Set-based filtering
 */
export function valueToFilterString(
  value: string | number | null,
  field: ColumnField
): string {
  if (value === null || value === undefined) {
    return ''
  }

  // For dates, use ISO string for consistent sorting/comparison
  if (field === 'date' && typeof value === 'string') {
    return value // Already ISO format
  }

  // For numbers, use consistent decimal format
  if (typeof value === 'number') {
    // Use fixed precision for currency fields
    if (
      field === 'total' ||
      field === 'bills_remaining' ||
      field === 'cash_available' ||
      field === 'cash_per_week' ||
      field === 'spending_per_day' ||
      isAccountColumn(field)
    ) {
      return value.toFixed(2)
    }
    return String(value)
  }

  return String(value)
}

/**
 * Extract unique values from a column across all projections
 * Returns sorted unique values and metadata
 */
export function extractUniqueValues(
  projections: FinanceProjection[],
  field: ColumnField
): UniqueValuesResult {
  const valueSet = new Set<string>()
  let hasBlanks = false

  for (const projection of projections) {
    const rawValue = getColumnValue(projection, field)
    
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      hasBlanks = true
    } else {
      const filterString = valueToFilterString(rawValue, field)
      valueSet.add(filterString)
    }
  }

  // Convert to array and sort
  const values = Array.from(valueSet)
  
  // Sort based on field type
  values.sort((a, b) => {
    // Numeric sorting for number/currency fields
    if (
      field === 'year' ||
      field === 'days_remaining' ||
      field === 'total' ||
      field === 'bills_remaining' ||
      field === 'cash_available' ||
      field === 'cash_per_week' ||
      field === 'spending_per_day' ||
      isAccountColumn(field)
    ) {
      const numA = parseFloat(a)
      const numB = parseFloat(b)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
    }
    
    // Date sorting
    if (field === 'date') {
      return a.localeCompare(b) // ISO dates sort correctly as strings
    }
    
    // Default: alphabetical
    return a.localeCompare(b)
  })

  return {
    values,
    hasBlanks,
    count: values.length,
  }
}

// =============================================================================
// FILTER APPLICATION
// =============================================================================

/**
 * Apply a text filter operator to test a value
 */
function applyTextOperator(
  value: string,
  operator: TextFilterOperator,
  filterValue: string
): boolean {
  const lowerValue = value.toLowerCase()
  const lowerFilter = filterValue.toLowerCase()

  switch (operator) {
    case 'contains':
      return lowerValue.includes(lowerFilter)
    case 'does_not_contain':
      return !lowerValue.includes(lowerFilter)
    case 'equals':
      return lowerValue === lowerFilter
    case 'does_not_equal':
      return lowerValue !== lowerFilter
    case 'begins_with':
      return lowerValue.startsWith(lowerFilter)
    case 'ends_with':
      return lowerValue.endsWith(lowerFilter)
    case 'is_empty':
      return value.trim() === ''
    case 'is_not_empty':
      return value.trim() !== ''
    default:
      return true
  }
}

/**
 * Test if a projection matches a column filter
 * Returns true if the projection passes the filter
 */
export function applyColumnFilter(
  projection: FinanceProjection,
  field: ColumnField,
  filter: ColumnFilter
): boolean {
  const rawValue = getColumnValue(projection, field)
  const isBlank = rawValue === null || rawValue === undefined || rawValue === ''

  if (isValueFilter(filter)) {
    // Value-based filter (checkbox selection)
    if (isBlank) {
      return filter.includeBlanks
    }
    
    const filterString = valueToFilterString(rawValue, field)
    return filter.values.has(filterString)
  }

  if (isTextFilter(filter)) {
    // Text-based filter
    if (isBlank) {
      // Handle empty checks
      if (filter.operator === 'is_empty') return true
      if (filter.operator === 'is_not_empty') return false
      return false // Empty values don't match text filters
    }

    const stringValue = String(rawValue)
    return applyTextOperator(stringValue, filter.operator, filter.value)
  }

  // Unknown filter type - pass through
  return true
}

/**
 * Apply all active filters to projections
 * Returns filtered projections (all filters are AND-ed together)
 */
export function applyAllFilters(
  projections: FinanceProjection[],
  filters: FilterState
): FinanceProjection[] {
  // No filters = return all
  if (filters.size === 0) {
    return projections
  }

  return projections.filter((projection) => {
    // All filters must pass (AND logic)
    for (const [field, filter] of filters) {
      if (!applyColumnFilter(projection, field, filter)) {
        return false
      }
    }
    return true
  })
}

// =============================================================================
// DROPDOWN VALUE FILTERING
// =============================================================================

/**
 * Filter dropdown values by search term
 * Case-insensitive matching
 */
export function getFilteredValues(
  allValues: string[],
  searchTerm: string
): string[] {
  if (!searchTerm.trim()) {
    return allValues
  }

  const lowerSearch = searchTerm.toLowerCase()
  return allValues.filter((value) =>
    value.toLowerCase().includes(lowerSearch)
  )
}

/**
 * Get display values with search filtering
 * Returns both the filter string and display string
 */
export function getFilteredDisplayValues(
  projections: FinanceProjection[],
  field: ColumnField,
  searchTerm: string
): Array<{ filterValue: string; displayValue: string }> {
  const uniqueResult = extractUniqueValues(projections, field)
  const filtered = getFilteredValues(uniqueResult.values, searchTerm)

  return filtered.map((filterValue) => {
    // For display, we need to convert back to the original value type
    // then format it nicely
    let displayValue: string

    // Parse the filter value based on field type
    if (
      field === 'year' ||
      field === 'days_remaining' ||
      field === 'total' ||
      field === 'bills_remaining' ||
      field === 'cash_available' ||
      field === 'cash_per_week' ||
      field === 'spending_per_day' ||
      isAccountColumn(field)
    ) {
      const numValue = parseFloat(filterValue)
      displayValue = formatValueForDisplay(numValue, field)
    } else if (field === 'date') {
      displayValue = formatValueForDisplay(filterValue, field)
    } else {
      displayValue = filterValue
    }

    return { filterValue, displayValue }
  })
}

// =============================================================================
// FILTER STATE MANAGEMENT
// =============================================================================

/**
 * Clear filter for a specific column
 * Returns a new FilterState with the column filter removed
 */
export function clearColumnFilter(
  filters: FilterState,
  field: ColumnField
): FilterState {
  const newFilters = new Map(filters)
  newFilters.delete(field)
  return newFilters
}

/**
 * Clear all filters
 * Returns an empty FilterState
 */
export function clearAllFilters(): FilterState {
  return createEmptyFilterState()
}

/**
 * Set a filter for a column
 * Returns a new FilterState with the filter applied
 */
export function setColumnFilter(
  filters: FilterState,
  field: ColumnField,
  filter: ColumnFilter
): FilterState {
  const newFilters = new Map(filters)
  newFilters.set(field, filter)
  return newFilters
}

/**
 * Toggle a value in a value filter
 * Returns the updated filter, or null if filter becomes empty (select all)
 */
export function toggleFilterValue(
  filter: ColumnFilter | null,
  allValues: string[],
  toggleValue: string,
  hasBlanks: boolean
): ColumnFilter | null {
  // If no filter exists, we're starting fresh - select all except the toggled value
  if (!filter || !isValueFilter(filter)) {
    const values = new Set(allValues)
    values.delete(toggleValue)
    
    // If toggling would leave all selected, return null (no filter)
    if (values.size === allValues.length - 1 && (!hasBlanks || filter?.type === 'value' && filter.includeBlanks)) {
      return {
        type: 'value',
        values,
        includeBlanks: true,
      }
    }
    
    return {
      type: 'value',
      values,
      includeBlanks: true,
    }
  }

  // Toggle the value in existing filter
  const newValues = new Set(filter.values)
  
  if (newValues.has(toggleValue)) {
    newValues.delete(toggleValue)
  } else {
    newValues.add(toggleValue)
  }

  // If all values are now selected (and blanks match), clear the filter
  if (
    newValues.size === allValues.length &&
    filter.includeBlanks === hasBlanks
  ) {
    return null
  }

  return {
    type: 'value',
    values: newValues,
    includeBlanks: filter.includeBlanks,
  }
}

/**
 * Check if a filter has any active filtering
 * Returns false if the filter would show all values
 */
export function isFilterActive(filter: ColumnFilter | null): boolean {
  if (!filter) return false

  if (isValueFilter(filter)) {
    // A value filter is active if it has selected values
    return filter.values.size > 0
  }

  if (isTextFilter(filter)) {
    // A text filter is active if it has a value (except for is_empty/is_not_empty)
    if (filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return true
    }
    return filter.value.trim().length > 0
  }

  return false
}

/**
 * Get the count of active filters
 */
export function getActiveFilterCount(filters: FilterState): number {
  let count = 0
  for (const filter of filters.values()) {
    if (isFilterActive(filter)) {
      count++
    }
  }
  return count
}
