'use client'

/**
 * TableHeaderFilterSort Component
 * 
 * Excel-style filter/sort dropdown for table headers.
 * Supports:
 * - Cascading sort (with priority indicators)
 * - Value-based filtering (checkbox selection)
 * - Text-based filtering (for Notes column)
 * - Search within dropdown values
 * - Glass design system styling
 * - Light/dark mode support
 * 
 * @module components/finance/TableHeaderFilterSort
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ArrowUp, ArrowDown, Filter, X, Search, Check } from 'lucide-react'
import type { FinanceProjection } from '@/app/actions/finance'
import type {
  ColumnConfig,
  ColumnField,
  ColumnFilter,
  SortRule,
  SortDirection,
  TextFilterOperator,
  FilterDropdownState,
} from '@/types/finance/filterTypes'
import {
  createValueFilter,
  createTextFilter,
  createInitialDropdownState,
  isValueFilter,
  isTextFilter,
} from '@/types/finance/filterTypes'
import {
  extractUniqueValues,
  getFilteredDisplayValues,
  isFilterActive,
} from '@/lib/finance/filterUtils'
import { getSortDirectionLabel, getSortArrow } from '@/lib/finance/sortUtils'

// =============================================================================
// TYPES
// =============================================================================

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
  /** Additional className for the trigger button */
  className?: string
}

// =============================================================================
// TEXT FILTER OPTIONS
// =============================================================================

const TEXT_FILTER_OPTIONS: Array<{ operator: TextFilterOperator; label: string }> = [
  { operator: 'contains', label: 'Contains' },
  { operator: 'does_not_contain', label: 'Does Not Contain' },
  { operator: 'equals', label: 'Equals' },
  { operator: 'does_not_equal', label: 'Does Not Equal' },
  { operator: 'begins_with', label: 'Begins With' },
  { operator: 'ends_with', label: 'Ends With' },
  { operator: 'is_empty', label: 'Is Empty' },
  { operator: 'is_not_empty', label: 'Is Not Empty' },
]

// =============================================================================
// COMPONENT
// =============================================================================

export function TableHeaderFilterSort({
  column,
  projections,
  currentFilter,
  currentSort,
  onFilterChange,
  onSortChange,
  className,
}: TableHeaderFilterSortProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownState, setDropdownState] = useState<FilterDropdownState>(() =>
    createInitialDropdownState(currentFilter)
  )
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset dropdown state when popover opens
  useEffect(() => {
    if (isOpen) {
      const initialState = createInitialDropdownState(currentFilter)
      
      // If no existing filter, initialize with all values selected
      if (!currentFilter && projections.length > 0) {
        const allValues = extractUniqueValues(projections, column.field)
        initialState.selectedValues = new Set(allValues.values)
        initialState.includeBlanks = allValues.hasBlanks
      }
      
      setDropdownState(initialState)
      // Focus search input after a small delay for animation
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, currentFilter, projections, column.field])

  // Extract unique values for this column
  const uniqueValues = useMemo(() => {
    return extractUniqueValues(projections, column.field)
  }, [projections, column.field])

  // Get filtered display values based on search term
  const filteredValues = useMemo(() => {
    return getFilteredDisplayValues(projections, column.field, dropdownState.searchTerm)
  }, [projections, column.field, dropdownState.searchTerm])

  // Check if all visible values are selected
  const allVisibleSelected = useMemo(() => {
    return filteredValues.length > 0 && 
      filteredValues.every((v) => dropdownState.selectedValues.has(v.filterValue))
  }, [filteredValues, dropdownState.selectedValues])

  // Check if no values are selected
  const noneSelected = useMemo(() => {
    return dropdownState.selectedValues.size === 0 && !dropdownState.includeBlanks
  }, [dropdownState.selectedValues.size, dropdownState.includeBlanks])

  // Check if column has active filter
  const hasActiveFilter = isFilterActive(currentFilter)

  // Handle sort button click
  const handleSort = useCallback(
    (direction: SortDirection) => {
      if (currentSort?.direction === direction) {
        // If already sorted in this direction, remove sort
        onSortChange(column.field, null)
      } else {
        onSortChange(column.field, direction)
      }
      setIsOpen(false)
    },
    [column.field, currentSort?.direction, onSortChange]
  )

  // Handle select all - selects ALL unique values (not just filtered)
  const handleSelectAll = useCallback(() => {
    setDropdownState((prev) => ({
      ...prev,
      selectedValues: new Set(uniqueValues.values),
      includeBlanks: uniqueValues.hasBlanks,
    }))
  }, [uniqueValues])

  // Handle select none - clears all selections
  const handleSelectNone = useCallback(() => {
    setDropdownState((prev) => ({
      ...prev,
      selectedValues: new Set<string>(),
      includeBlanks: false,
    }))
  }, [])

  // Handle individual value toggle
  const handleValueToggle = useCallback((filterValue: string) => {
    setDropdownState((prev) => {
      const newSelected = new Set(prev.selectedValues)
      if (newSelected.has(filterValue)) {
        newSelected.delete(filterValue)
      } else {
        newSelected.add(filterValue)
      }
      return {
        ...prev,
        selectedValues: newSelected,
      }
    })
  }, [])

  // Handle blanks toggle
  const handleBlanksToggle = useCallback(() => {
    setDropdownState((prev) => ({
      ...prev,
      includeBlanks: !prev.includeBlanks,
    }))
  }, [])

  // Handle search term change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDropdownState((prev) => ({
      ...prev,
      searchTerm: e.target.value,
    }))
  }, [])

  // Handle text filter operator change
  const handleTextOperatorChange = useCallback((operator: TextFilterOperator) => {
    setDropdownState((prev) => ({
      ...prev,
      textOperator: operator,
    }))
  }, [])

  // Handle text filter value change
  const handleTextValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDropdownState((prev) => ({
      ...prev,
      textValue: e.target.value,
    }))
  }, [])

  // Toggle between value and text filter modes
  const handleModeToggle = useCallback((mode: 'value' | 'text') => {
    setDropdownState((prev) => ({
      ...prev,
      activeMode: mode,
    }))
  }, [])

  // Apply filter
  const handleApply = useCallback(() => {
    if (dropdownState.activeMode === 'value') {
      // Value filter mode
      if (
        dropdownState.selectedValues.size === 0 ||
        (dropdownState.selectedValues.size === uniqueValues.values.length &&
          dropdownState.includeBlanks === uniqueValues.hasBlanks)
      ) {
        // All selected = no filter
        onFilterChange(column.field, null)
      } else {
        const filter = createValueFilter(
          dropdownState.selectedValues,
          dropdownState.includeBlanks
        )
        onFilterChange(column.field, filter)
      }
    } else {
      // Text filter mode
      if (
        !dropdownState.textValue.trim() &&
        dropdownState.textOperator !== 'is_empty' &&
        dropdownState.textOperator !== 'is_not_empty'
      ) {
        // Empty text = no filter (unless is_empty/is_not_empty)
        onFilterChange(column.field, null)
      } else {
        const filter = createTextFilter(
          dropdownState.textOperator,
          dropdownState.textValue
        )
        onFilterChange(column.field, filter)
      }
    }
    setIsOpen(false)
  }, [
    column.field,
    dropdownState,
    onFilterChange,
    uniqueValues.values.length,
    uniqueValues.hasBlanks,
  ])

  // Clear filter
  const handleClearFilter = useCallback(() => {
    onFilterChange(column.field, null)
    setDropdownState(createInitialDropdownState(null))
    setIsOpen(false)
  }, [column.field, onFilterChange])

  // Cancel changes
  const handleCancel = useCallback(() => {
    setDropdownState(createInitialDropdownState(currentFilter))
    setIsOpen(false)
  }, [currentFilter])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleApply()
      }
    },
    [handleCancel, handleApply]
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`
            flex items-center gap-1 
            hover:bg-white/20 dark:hover:bg-white/10 
            px-1.5 py-0.5 rounded transition-colors
            text-xs font-medium
            glass-text-secondary
            ${className || ''}
          `}
          aria-label={`Filter and sort ${column.label}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <span>{column.label}</span>
          
          {/* Sort indicator */}
          {currentSort && (
            <span className="flex items-center text-blue-400 dark:text-blue-300">
              <span className="text-[10px]">{getSortArrow(currentSort.direction)}</span>
              {currentSort.priority > 1 && (
                <span className="text-[8px] ml-0.5 bg-blue-500/30 px-1 rounded">
                  {currentSort.priority}
                </span>
              )}
            </span>
          )}
          
          {/* Filter indicator */}
          {hasActiveFilter && (
            <Filter className="h-3 w-3 text-amber-400 dark:text-amber-300" />
          )}
          
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0 glass-large border border-white/20 dark:border-white/10 shadow-xl"
        align="start"
        sideOffset={4}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/10 dark:border-white/5">
          <h4 className="text-sm font-semibold glass-text-primary">{column.label}</h4>
        </div>

        {/* Sort Section */}
        {column.sortable && (
          <div className="p-2 border-b border-white/10 dark:border-white/5">
            <div className="text-xs glass-text-secondary mb-1.5 font-medium">Sort</div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleSort('asc')}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded text-xs w-full text-left
                  transition-colors
                  ${
                    currentSort?.direction === 'asc'
                      ? 'bg-blue-500/20 text-blue-400 dark:text-blue-300'
                      : 'hover:bg-white/10 glass-text-primary'
                  }
                `}
                aria-pressed={currentSort?.direction === 'asc'}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>{getSortDirectionLabel('asc', column.dataType)}</span>
                {currentSort?.direction === 'asc' && (
                  <Check className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
              <button
                onClick={() => handleSort('desc')}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded text-xs w-full text-left
                  transition-colors
                  ${
                    currentSort?.direction === 'desc'
                      ? 'bg-blue-500/20 text-blue-400 dark:text-blue-300'
                      : 'hover:bg-white/10 glass-text-primary'
                  }
                `}
                aria-pressed={currentSort?.direction === 'desc'}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>{getSortDirectionLabel('desc', column.dataType)}</span>
                {currentSort?.direction === 'desc' && (
                  <Check className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Filter Section */}
        {column.filterable && (
          <div className="p-2">
            {/* Filter Mode Toggle (for columns that support text filters) */}
            {column.supportsTextFilter && (
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => handleModeToggle('value')}
                  className={`
                    flex-1 px-2 py-1 rounded text-xs font-medium transition-colors
                    ${
                      dropdownState.activeMode === 'value'
                        ? 'bg-white/20 glass-text-primary'
                        : 'hover:bg-white/10 glass-text-secondary'
                    }
                  `}
                >
                  By Value
                </button>
                <button
                  onClick={() => handleModeToggle('text')}
                  className={`
                    flex-1 px-2 py-1 rounded text-xs font-medium transition-colors
                    ${
                      dropdownState.activeMode === 'text'
                        ? 'bg-white/20 glass-text-primary'
                        : 'hover:bg-white/10 glass-text-secondary'
                    }
                  `}
                >
                  Text Filter
                </button>
              </div>
            )}

            {/* Value Filter Mode */}
            {dropdownState.activeMode === 'value' && (
              <>
                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 glass-text-secondary" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={dropdownState.searchTerm}
                    onChange={handleSearchChange}
                    className="pl-7 h-7 text-xs glass-small"
                  />
                </div>

                {/* Select All / Select None */}
                <div className="flex items-center gap-1 px-1 py-1 border-b border-white/10 dark:border-white/5 mb-1">
                  <button
                    onClick={handleSelectAll}
                    className="flex-1 px-2 py-1 text-xs rounded hover:bg-white/10 glass-text-primary transition-colors"
                    aria-label="Select all values"
                  >
                    Select All
                  </button>
                  <span className="glass-text-secondary text-xs">|</span>
                  <button
                    onClick={handleSelectNone}
                    className="flex-1 px-2 py-1 text-xs rounded hover:bg-white/10 glass-text-primary transition-colors"
                    aria-label="Select none"
                  >
                    Select None
                  </button>
                </div>

                {/* Value List */}
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {/* Blanks option */}
                  {uniqueValues.hasBlanks && (
                    <div className="flex items-center gap-2 px-1 py-1 hover:bg-white/10 rounded">
                      <Checkbox
                        checked={dropdownState.includeBlanks}
                        onCheckedChange={handleBlanksToggle}
                        id="include-blanks"
                        aria-label="Include blanks"
                      />
                      <label
                        htmlFor="include-blanks"
                        className="text-xs glass-text-secondary cursor-pointer flex-1 italic"
                      >
                        (Blanks)
                      </label>
                    </div>
                  )}

                  {/* Value checkboxes */}
                  {filteredValues.map(({ filterValue, displayValue }) => (
                    <div
                      key={filterValue}
                      className="flex items-center gap-2 px-1 py-1 hover:bg-white/10 rounded"
                    >
                      <Checkbox
                        checked={dropdownState.selectedValues.has(filterValue)}
                        onCheckedChange={() => handleValueToggle(filterValue)}
                        id={`value-${filterValue}`}
                        aria-label={`Select ${displayValue}`}
                      />
                      <label
                        htmlFor={`value-${filterValue}`}
                        className="text-xs glass-text-primary cursor-pointer flex-1 truncate"
                        title={displayValue}
                      >
                        {displayValue}
                      </label>
                    </div>
                  ))}

                  {filteredValues.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs glass-text-secondary">
                      No matching values
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Text Filter Mode */}
            {dropdownState.activeMode === 'text' && (
              <div className="space-y-2">
                {/* Operator Select */}
                <div className="space-y-1">
                  {TEXT_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.operator}
                      onClick={() => handleTextOperatorChange(option.operator)}
                      className={`
                        flex items-center gap-2 px-2 py-1 rounded text-xs w-full text-left
                        transition-colors
                        ${
                          dropdownState.textOperator === option.operator
                            ? 'bg-white/20 glass-text-primary'
                            : 'hover:bg-white/10 glass-text-secondary'
                        }
                      `}
                    >
                      {dropdownState.textOperator === option.operator && (
                        <Check className="h-3 w-3" />
                      )}
                      <span className={dropdownState.textOperator === option.operator ? '' : 'ml-5'}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Text Value Input (not shown for is_empty/is_not_empty) */}
                {dropdownState.textOperator !== 'is_empty' &&
                  dropdownState.textOperator !== 'is_not_empty' && (
                    <Input
                      type="text"
                      placeholder="Enter filter text..."
                      value={dropdownState.textValue}
                      onChange={handleTextValueChange}
                      className="h-7 text-xs glass-small"
                    />
                  )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 px-2 py-2 border-t border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/10">
          {hasActiveFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filter
            </Button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs glass-text-secondary"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApply}
              className="text-xs"
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default TableHeaderFilterSort
