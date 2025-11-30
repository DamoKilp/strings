/**
 * Filter & Sort Type System for Historical Spend Tracking
 * 
 * This module defines the type system for Excel-style filtering and cascading sorting
 * of the HistoricalSpendTrackingTab table.
 * 
 * @module types/finance/filterTypes
 */

import type { FinanceProjection } from '@/app/actions/finance'

// =============================================================================
// COLUMN FIELD TYPES
// =============================================================================

/**
 * Static column identifiers that map to FinanceProjection properties
 * These are fixed columns available in every projection
 */
export type StaticColumnField =
  | 'date'           // projection_date (ISO string)
  | 'year'           // derived from projection_date
  | 'time'           // entry_time (HH:MM:SS)
  | 'days_remaining' // days_remaining (number)
  | 'total'          // total_available (number)
  | 'bills_remaining'// bills_remaining (number)
  | 'cash_available' // cash_available (number)
  | 'cash_per_week'  // cash_per_week (number | null)
  | 'spending_per_day' // spending_per_day (number | null)
  | 'notes'          // notes (string | null)

/**
 * Dynamic account column fields use a branded type pattern
 * Format: "account_${accountId}" where accountId is the UUID
 */
export type AccountColumnField = `account_${string}`

/**
 * All possible column field identifiers
 * Can be a static column or a dynamic account column
 */
export type ColumnField = StaticColumnField | AccountColumnField

/**
 * Type guard to check if a field is an account column
 */
export function isAccountColumn(field: ColumnField): field is AccountColumnField {
  return field.startsWith('account_')
}

/**
 * Extract account ID from an account column field
 */
export function getAccountId(field: AccountColumnField): string {
  return field.slice(8) // Remove 'account_' prefix
}

/**
 * Create an account column field from an account ID
 */
export function createAccountColumnField(accountId: string): AccountColumnField {
  return `account_${accountId}` as AccountColumnField
}

// =============================================================================
// FILTER TYPES
// =============================================================================

/**
 * Filter type discriminator
 * - 'value': Checkbox-based selection of specific values (like Excel)
 * - 'text': Text-based filtering with operators (Contains, Equals, etc.)
 */
export type FilterType = 'value' | 'text'

/**
 * Text filter operators for string-based filtering
 * Primarily used for the Notes column
 */
export type TextFilterOperator =
  | 'contains'
  | 'does_not_contain'
  | 'equals'
  | 'does_not_equal'
  | 'begins_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'

/**
 * Value-based filter (checkbox selection)
 * Used for selecting specific values from a column
 */
export interface ValueFilter {
  type: 'value'
  /** Set of selected values (as strings for consistent comparison) */
  values: Set<string>
  /** Whether to show blanks/nulls */
  includeBlanks: boolean
}

/**
 * Text-based filter with operator
 * Used primarily for Notes column
 */
export interface TextFilter {
  type: 'text'
  operator: TextFilterOperator
  /** The text value to match against (case-insensitive) */
  value: string
}

/**
 * Union type for column filter configurations
 */
export type ColumnFilter = ValueFilter | TextFilter

/**
 * Type guard for value filter
 */
export function isValueFilter(filter: ColumnFilter): filter is ValueFilter {
  return filter.type === 'value'
}

/**
 * Type guard for text filter
 */
export function isTextFilter(filter: ColumnFilter): filter is TextFilter {
  return filter.type === 'text'
}

/**
 * Map of column field to its active filter configuration
 * Using Map for efficient lookups and mutations
 */
export type FilterState = Map<ColumnField, ColumnFilter>

// =============================================================================
// SORT TYPES
// =============================================================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * A single sort rule with priority
 * Lower priority number = higher precedence (1 is primary sort)
 */
export interface SortRule {
  field: ColumnField
  direction: SortDirection
  /** 1-based priority: 1 = primary, 2 = secondary, etc. */
  priority: number
}

/**
 * Array of sort rules, ordered by priority
 * An empty array means no sorting is applied
 */
export type SortState = SortRule[]

// =============================================================================
// COLUMN CONFIGURATION
// =============================================================================

/**
 * Data type of a column, used for formatting and sorting logic
 */
export type ColumnDataType = 'date' | 'time' | 'number' | 'text' | 'currency'

/**
 * Column metadata for filter/sort component configuration
 */
export interface ColumnConfig {
  field: ColumnField
  /** Display label for the column header */
  label: string
  /** Data type affects sorting logic and formatting */
  dataType: ColumnDataType
  /** Whether this column can be filtered */
  filterable: boolean
  /** Whether this column can be sorted */
  sortable: boolean
  /** Whether text filter options should be shown (in addition to value filter) */
  supportsTextFilter: boolean
  /** Column width class (Tailwind) */
  widthClass?: string
  /** Alignment for cell content */
  align: 'left' | 'center' | 'right'
  /** Whether this is a computed/derived column */
  isComputed?: boolean
}

// =============================================================================
// FILTER DROPDOWN STATE
// =============================================================================

/**
 * State for a filter dropdown's pending changes
 * Applied only when user clicks OK, discarded on Cancel
 */
export interface FilterDropdownState {
  /** Search term for filtering the value list */
  searchTerm: string
  /** Currently selected values (pending, not yet applied) */
  selectedValues: Set<string>
  /** Whether blanks are included (pending) */
  includeBlanks: boolean
  /** For text filter mode */
  textOperator: TextFilterOperator
  /** Text filter value (pending) */
  textValue: string
  /** Current mode: 'value' for checkbox selection, 'text' for text filter */
  activeMode: FilterType
}

// =============================================================================
// COMPONENT PROPS TYPES
// =============================================================================

/**
 * Props for the TableHeaderFilterSort component
 */
export interface TableHeaderFilterSortProps {
  /** Column configuration */
  column: ColumnConfig
  /** All projections (for extracting unique values) */
  projections: FinanceProjection[]
  /** Current filter for this column (null if none) */
  currentFilter: ColumnFilter | null
  /** Current sort rule for this column (null if not sorted) */
  currentSort: SortRule | null
  /** Callback when filter changes */
  onFilterChange: (field: ColumnField, filter: ColumnFilter | null) => void
  /** Callback when sort changes */
  onSortChange: (field: ColumnField, direction: SortDirection | null) => void
  /** All unique account IDs (for account columns) */
  accountIds?: string[]
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Result of extracting unique values from a column
 */
export interface UniqueValuesResult {
  /** Unique string values found in the column */
  values: string[]
  /** Whether any null/undefined/empty values exist */
  hasBlanks: boolean
  /** Total count of non-blank values */
  count: number
}

/**
 * Filter change event payload
 */
export interface FilterChangeEvent {
  field: ColumnField
  filter: ColumnFilter | null
  /** Previous filter state (for undo) */
  previousFilter: ColumnFilter | null
}

/**
 * Sort change event payload
 */
export interface SortChangeEvent {
  field: ColumnField
  direction: SortDirection | null
  /** Previous sort state (for undo) */
  previousSortState: SortState
}

// =============================================================================
// FACTORY FUNCTIONS (for creating filter/sort state)
// =============================================================================

/**
 * Create an empty filter state
 */
export function createEmptyFilterState(): FilterState {
  return new Map()
}

/**
 * Create an empty sort state
 */
export function createEmptySortState(): SortState {
  return []
}

/**
 * Create a value filter with selected values
 */
export function createValueFilter(
  values: Set<string> | string[],
  includeBlanks = false
): ValueFilter {
  return {
    type: 'value',
    values: values instanceof Set ? values : new Set(values),
    includeBlanks,
  }
}

/**
 * Create a text filter with operator and value
 */
export function createTextFilter(
  operator: TextFilterOperator,
  value: string
): TextFilter {
  return {
    type: 'text',
    operator,
    value,
  }
}

/**
 * Create a sort rule
 */
export function createSortRule(
  field: ColumnField,
  direction: SortDirection,
  priority: number
): SortRule {
  return { field, direction, priority }
}

/**
 * Create initial dropdown state
 */
export function createInitialDropdownState(
  existingFilter: ColumnFilter | null
): FilterDropdownState {
  if (existingFilter && isValueFilter(existingFilter)) {
    return {
      searchTerm: '',
      selectedValues: new Set(existingFilter.values),
      includeBlanks: existingFilter.includeBlanks,
      textOperator: 'contains',
      textValue: '',
      activeMode: 'value',
    }
  }
  
  if (existingFilter && isTextFilter(existingFilter)) {
    return {
      searchTerm: '',
      selectedValues: new Set(),
      includeBlanks: true,
      textOperator: existingFilter.operator,
      textValue: existingFilter.value,
      activeMode: 'text',
    }
  }
  
  // Default: no filter, all values selected mode
  return {
    searchTerm: '',
    selectedValues: new Set(),
    includeBlanks: true,
    textOperator: 'contains',
    textValue: '',
    activeMode: 'value',
  }
}

// =============================================================================
// COLUMN CONFIGURATION HELPERS
// =============================================================================

/**
 * Default column configurations for static columns
 */
export const DEFAULT_COLUMN_CONFIGS: Record<StaticColumnField, Omit<ColumnConfig, 'field'>> = {
  date: {
    label: 'Date',
    dataType: 'date',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'center',
  },
  year: {
    label: 'Year',
    dataType: 'number',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'center',
    isComputed: true,
  },
  time: {
    label: 'Time',
    dataType: 'time',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'center',
  },
  days_remaining: {
    label: 'Days Remaining',
    dataType: 'number',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'center',
  },
  total: {
    label: 'Total',
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  },
  bills_remaining: {
    label: 'Bills Remaining',
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  },
  cash_available: {
    label: 'Cash Available',
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  },
  cash_per_week: {
    label: 'Cash per Week',
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  },
  spending_per_day: {
    label: 'Spending per Day',
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  },
  notes: {
    label: 'Notes',
    dataType: 'text',
    filterable: true,
    sortable: true,
    supportsTextFilter: true, // Notes column supports text filters
    align: 'left',
  },
}

/**
 * Create a column config for a static column
 */
export function createStaticColumnConfig(field: StaticColumnField): ColumnConfig {
  return {
    field,
    ...DEFAULT_COLUMN_CONFIGS[field],
  }
}

/**
 * Create a column config for an account column
 */
export function createAccountColumnConfig(
  accountId: string,
  accountName: string
): ColumnConfig {
  return {
    field: createAccountColumnField(accountId),
    label: accountName,
    dataType: 'currency',
    filterable: true,
    sortable: true,
    supportsTextFilter: false,
    align: 'right',
  }
}
