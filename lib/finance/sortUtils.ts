/**
 * Sort Utilities for Historical Spend Tracking
 * 
 * Provides functions for cascading (multi-column) sorting with priority management.
 * Supports all column types with appropriate comparison logic.
 * 
 * @module lib/finance/sortUtils
 */

import type { FinanceProjection } from '@/app/actions/finance'
import type {
  ColumnField,
  SortRule,
  SortState,
  SortDirection,
} from '@/types/finance/filterTypes'
import { createEmptySortState, isAccountColumn, getAccountId } from '@/types/finance/filterTypes'
import { getColumnValue } from './filterUtils'

// =============================================================================
// CASCADING SORT
// =============================================================================

/**
 * Compare two values for sorting
 * Handles null/undefined, numbers, strings, and dates
 */
function compareValues(
  a: string | number | null,
  b: string | number | null,
  field: ColumnField,
  direction: SortDirection
): number {
  // Handle nulls - always sort to end regardless of direction
  const aIsNull = a === null || a === undefined
  const bIsNull = b === null || b === undefined

  if (aIsNull && bIsNull) return 0
  if (aIsNull) return 1 // a goes to end
  if (bIsNull) return -1 // b goes to end

  let comparison = 0

  // Determine comparison based on field type
  switch (field) {
    case 'date':
      // Date comparison (ISO string format sorts correctly)
      if (typeof a === 'string' && typeof b === 'string') {
        comparison = a.localeCompare(b)
      }
      break

    case 'time':
      // Time comparison (HH:MM:SS format sorts correctly)
      if (typeof a === 'string' && typeof b === 'string') {
        comparison = a.localeCompare(b)
      }
      break

    case 'year':
    case 'days_remaining':
    case 'total':
    case 'bills_remaining':
    case 'cash_available':
    case 'cash_per_week':
    case 'spending_per_day':
      // Numeric comparison
      if (typeof a === 'number' && typeof b === 'number') {
        comparison = a - b
      }
      break

    case 'notes':
      // String comparison (case-insensitive)
      if (typeof a === 'string' && typeof b === 'string') {
        comparison = a.toLowerCase().localeCompare(b.toLowerCase())
      }
      break

    default:
      // Account columns - numeric comparison
      if (isAccountColumn(field)) {
        if (typeof a === 'number' && typeof b === 'number') {
          comparison = a - b
        }
      }
      break
  }

  // Apply direction
  return direction === 'asc' ? comparison : -comparison
}

/**
 * Apply cascading sort to projections
 * Sorts by multiple rules in priority order (1 = primary, 2 = secondary, etc.)
 * 
 * @param projections - Array of projections to sort
 * @param sortRules - Array of sort rules, will be applied in priority order
 * @returns New sorted array (original is not mutated)
 */
export function applyCascadingSort(
  projections: FinanceProjection[],
  sortRules: SortState
): FinanceProjection[] {
  // No sorting if no rules
  if (sortRules.length === 0) {
    return projections
  }

  // Sort rules by priority (ascending - lower number = higher priority)
  const orderedRules = [...sortRules].sort((a, b) => a.priority - b.priority)

  // Create a copy to avoid mutating original
  const sorted = [...projections]

  // Sort using all rules
  sorted.sort((a, b) => {
    for (const rule of orderedRules) {
      const valueA = getColumnValue(a, rule.field)
      const valueB = getColumnValue(b, rule.field)
      
      const comparison = compareValues(valueA, valueB, rule.field, rule.direction)
      
      // If not equal, return this comparison
      if (comparison !== 0) {
        return comparison
      }
      // If equal, continue to next sort rule
    }
    
    // All rules resulted in equality
    return 0
  })

  return sorted
}

// =============================================================================
// SORT STATE MANAGEMENT
// =============================================================================

/**
 * Add a new sort rule
 * - If field already has a sort rule, updates its direction
 * - Otherwise, adds a new rule with the next available priority
 * 
 * @param sortState - Current sort state
 * @param field - Column field to sort
 * @param direction - Sort direction
 * @returns New sort state with the rule added/updated
 */
export function addSortRule(
  sortState: SortState,
  field: ColumnField,
  direction: SortDirection
): SortState {
  // Check if field already has a sort rule
  const existingIndex = sortState.findIndex((rule) => rule.field === field)

  if (existingIndex !== -1) {
    // Update existing rule's direction, keep priority
    const newState = [...sortState]
    newState[existingIndex] = {
      ...newState[existingIndex],
      direction,
    }
    return newState
  }

  // Add new rule with next priority
  const maxPriority = sortState.reduce(
    (max, rule) => Math.max(max, rule.priority),
    0
  )

  return [
    ...sortState,
    {
      field,
      direction,
      priority: maxPriority + 1,
    },
  ]
}

/**
 * Remove a sort rule for a field
 * Renumbers priorities of remaining rules to maintain consecutive order
 * 
 * @param sortState - Current sort state
 * @param field - Column field to remove sort from
 * @returns New sort state with the rule removed
 */
export function removeSortRule(
  sortState: SortState,
  field: ColumnField
): SortState {
  // Filter out the rule
  const filtered = sortState.filter((rule) => rule.field !== field)

  // Renumber priorities to maintain consecutive order
  const sorted = [...filtered].sort((a, b) => a.priority - b.priority)
  return sorted.map((rule, index) => ({
    ...rule,
    priority: index + 1,
  }))
}

/**
 * Update an existing sort rule's direction
 * Does nothing if the field is not in the sort state
 * 
 * @param sortState - Current sort state
 * @param field - Column field to update
 * @param direction - New sort direction
 * @returns New sort state with updated direction
 */
export function updateSortRule(
  sortState: SortState,
  field: ColumnField,
  direction: SortDirection
): SortState {
  const index = sortState.findIndex((rule) => rule.field === field)

  if (index === -1) {
    return sortState // No change if field not found
  }

  const newState = [...sortState]
  newState[index] = {
    ...newState[index],
    direction,
  }
  return newState
}

/**
 * Toggle sort direction for a field, or add new sort rule
 * - If field not sorted: add ascending sort
 * - If ascending: change to descending
 * - If descending: remove sort
 * 
 * @param sortState - Current sort state
 * @param field - Column field to toggle
 * @returns New sort state
 */
export function toggleSort(
  sortState: SortState,
  field: ColumnField
): SortState {
  const existing = sortState.find((rule) => rule.field === field)

  if (!existing) {
    // Not sorted - add ascending
    return addSortRule(sortState, field, 'asc')
  }

  if (existing.direction === 'asc') {
    // Ascending - change to descending
    return updateSortRule(sortState, field, 'desc')
  }

  // Descending - remove sort
  return removeSortRule(sortState, field)
}

/**
 * Get the sort priority for a field
 * Returns null if the field is not in the sort state
 * 
 * @param sortState - Current sort state
 * @param field - Column field to check
 * @returns Priority number (1-based) or null if not sorted
 */
export function getSortPriority(
  sortState: SortState,
  field: ColumnField
): number | null {
  const rule = sortState.find((r) => r.field === field)
  return rule ? rule.priority : null
}

/**
 * Get the sort rule for a field
 * Returns null if the field is not in the sort state
 * 
 * @param sortState - Current sort state
 * @param field - Column field to check
 * @returns SortRule or null if not sorted
 */
export function getSortRule(
  sortState: SortState,
  field: ColumnField
): SortRule | null {
  return sortState.find((r) => r.field === field) ?? null
}

/**
 * Get the sort direction for a field
 * Returns null if the field is not sorted
 * 
 * @param sortState - Current sort state
 * @param field - Column field to check
 * @returns 'asc', 'desc', or null
 */
export function getSortDirection(
  sortState: SortState,
  field: ColumnField
): SortDirection | null {
  const rule = sortState.find((r) => r.field === field)
  return rule ? rule.direction : null
}

/**
 * Clear all sort rules
 * Returns an empty sort state
 */
export function clearAllSorts(): SortState {
  return createEmptySortState()
}

/**
 * Set a single sort (clearing all others)
 * Useful for simple single-column sorting
 * 
 * @param field - Column field to sort by
 * @param direction - Sort direction
 * @returns New sort state with only this rule
 */
export function setSingleSort(
  field: ColumnField,
  direction: SortDirection
): SortState {
  return [{ field, direction, priority: 1 }]
}

/**
 * Check if any sorting is active
 */
export function hasSorting(sortState: SortState): boolean {
  return sortState.length > 0
}

/**
 * Get count of active sort rules
 */
export function getSortCount(sortState: SortState): number {
  return sortState.length
}

/**
 * Maximum number of simultaneous sort rules allowed
 */
export const MAX_SORT_RULES = 4

/**
 * Check if we can add more sort rules
 */
export function canAddSortRule(sortState: SortState): boolean {
  return sortState.length < MAX_SORT_RULES
}

// =============================================================================
// SORT DISPLAY HELPERS
// =============================================================================

/**
 * Get display text for sort direction
 */
export function getSortDirectionLabel(
  direction: SortDirection,
  dataType: 'text' | 'number' | 'date' | 'time' | 'currency'
): string {
  if (direction === 'asc') {
    switch (dataType) {
      case 'text':
        return 'Sort A to Z'
      case 'number':
      case 'currency':
        return 'Sort Smallest to Largest'
      case 'date':
        return 'Sort Oldest to Newest'
      case 'time':
        return 'Sort Earliest to Latest'
      default:
        return 'Sort Ascending'
    }
  } else {
    switch (dataType) {
      case 'text':
        return 'Sort Z to A'
      case 'number':
      case 'currency':
        return 'Sort Largest to Smallest'
      case 'date':
        return 'Sort Newest to Oldest'
      case 'time':
        return 'Sort Latest to Earliest'
      default:
        return 'Sort Descending'
    }
  }
}

/**
 * Get arrow indicator for sort direction
 */
export function getSortArrow(direction: SortDirection): string {
  return direction === 'asc' ? '↑' : '↓'
}
