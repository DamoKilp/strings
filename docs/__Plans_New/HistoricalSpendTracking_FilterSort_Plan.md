# Historical Spend Tracking - Excel-Style Filter & Sort Implementation Plan

## Objectives
- Implement Excel-like filter/sort dropdown menu on each table header
- Support multiple simultaneous filters per column (checkbox-based value selection)
- Support cascading sorting (multiple sort columns with priority)
- Provide search functionality within filter dropdowns
- Display visual indicators for active filters and sorts
- Maintain existing functionality while adding new features
- Ensure accessibility and responsive design

## Non-Goals
- Color-based filtering/sorting (future enhancement)
- Sheet view functionality (out of scope)
- Filter persistence across page reloads (can be added later)
- Export filtered data (out of scope)

## Files & Modules

### Edit:
- `app/finance/HistoricalSpendTrackingTab.tsx` - Main component with filter/sort logic
- `app/finance/FinancePageClient.tsx` - May need minor updates if shared state

### Create:
- `components/finance/TableHeaderFilterSort.tsx` - Reusable filter/sort dropdown component
- `lib/finance/filterUtils.ts` - Filter logic utilities
- `lib/finance/sortUtils.ts` - Cascading sort logic utilities
- `types/finance/filterTypes.ts` - TypeScript types for filters and sorts

## Order of Execution

### Phase 1: Type System & Utilities (Foundation)
1. **Create type definitions** (`types/finance/filterTypes.ts`)
   - `ColumnFilter` interface for individual column filters
   - `FilterState` type for all active filters
   - `SortRule` interface for cascading sorts (field, direction, priority)
   - `SortState` type for multiple sort rules
   - Column field type union for type safety

2. **Create filter utilities** (`lib/finance/filterUtils.ts`)
   - `extractUniqueValues()` - Get unique values for a column
   - `applyColumnFilter()` - Apply single column filter to projection
   - `applyAllFilters()` - Apply all active filters
   - `getFilteredValues()` - Get available filter values for a column
   - `clearColumnFilter()` - Clear specific column filter
   - `clearAllFilters()` - Clear all filters

3. **Create sort utilities** (`lib/finance/sortUtils.ts`)
   - `applyCascadingSort()` - Apply multiple sort rules in priority order
   - `addSortRule()` - Add new sort rule (handles priority)
   - `removeSortRule()` - Remove sort rule
   - `updateSortRule()` - Update existing sort rule direction
   - `getSortPriority()` - Get current sort priority for a field

### Phase 2: UI Component (TableHeaderFilterSort)
4. **Create filter/sort dropdown component** (`components/finance/TableHeaderFilterSort.tsx`)
   - Use Popover from Radix UI for dropdown
   - Sort section:
     - "Sort A to Z" button (ascending)
     - "Sort Z to A" button (descending)
     - Visual indicator for current sort direction
     - Sort priority indicator (1, 2, 3...)
   - Filter section:
     - "Clear Filter" button (only shown when filter active)
     - Search input for filtering values
     - Checkbox list with "Select All" option
     - Scrollable list of unique values
     - OK/Cancel buttons
   - Glass design system styling
   - Light/dark mode support
   - Accessible keyboard navigation

### Phase 3: Integration & State Management
5. **Update HistoricalSpendTrackingTab state**
   - Replace single `sortField`/`sortDirection` with `SortState` (array of SortRule)
   - Replace individual filter states with `FilterState` (Map<column, ColumnFilter>)
   - Add state for open filter/sort dropdowns
   - Maintain backward compatibility with existing filters (year, date range, etc.)

6. **Update filtering logic**
   - Integrate `applyAllFilters()` from filterUtils
   - Combine new column filters with existing filters (year, date range, amount, accounts)
   - Preserve existing filter behavior

7. **Update sorting logic**
   - Replace single sort with `applyCascadingSort()` from sortUtils
   - Handle sort priority (first rule is primary, subsequent are secondary/tertiary)
   - Update sort indicators in headers

### Phase 4: Header Integration
8. **Update table headers**
   - Replace current sort buttons with `TableHeaderFilterSort` component
   - Add filter icon indicator when column has active filter
   - Add sort priority number badge when column is sorted
   - Show sort direction arrow (↑/↓) with priority
   - Apply to all sortable columns:
     - Date, Time, Days Remaining
     - Total, Bills Remaining, Cash Available
     - Cash per Week, Spending per Day
   - Apply to filterable columns:
     - Date (filter by specific dates)
     - Year (filter by year values)
     - Time (filter by time ranges)
     - Account columns (filter by account values)
     - Notes (text filter)
     - All numeric columns (range filters - future)

### Phase 5: Advanced Features
9. **Text Filters** (for Notes column)
   - Add "Text Filters" submenu
   - Options: Contains, Does Not Contain, Equals, Does Not Equal, Begins With, Ends With
   - Text input for filter value
   - Apply text filter logic

10. **Filter Value Extraction**
    - Extract unique values per column type:
      - Dates: unique dates
      - Years: unique years
      - Times: unique times or time ranges
      - Accounts: account names/IDs
      - Numbers: unique values or ranges
      - Notes: unique note values (for exact match) or text search

11. **Visual Indicators**
    - Filter icon (funnel) on headers with active filters
    - Sort priority badge (1, 2, 3...) next to sort arrows
    - Active filter count badge
    - "Clear All Filters" button in filter section

### Phase 6: Polish & Testing
12. **Performance optimization**
    - Memoize filter value extraction
    - Debounce search input in filter dropdown
    - Optimize cascading sort performance
    - Virtual scrolling for large filter lists (if needed)

13. **Accessibility**
    - ARIA labels for filter/sort buttons
    - Keyboard navigation in dropdowns
    - Screen reader announcements for filter/sort changes
    - Focus management

14. **Responsive design**
    - Ensure dropdowns work on mobile
    - Adjust dropdown width based on screen size
    - Touch-friendly checkbox targets

## Acceptance Criteria

### Behavior:
- ✅ Each table header has a filter/sort dropdown button
- ✅ Clicking header button opens Excel-style dropdown with sort and filter options
- ✅ Multiple filters can be active simultaneously (one per column)
- ✅ Multiple sort rules can be active (cascading sort)
- ✅ Filter dropdown shows unique values for column with checkboxes
- ✅ "Select All" checkbox selects/deselects all values
- ✅ Search input filters the available values in dropdown
- ✅ "Clear Filter" removes filter for that column
- ✅ Sort A to Z / Z to A applies sort and shows priority
- ✅ Sort priority is indicated by numbers (1, 2, 3...)
- ✅ Active filters show filter icon on header
- ✅ Active sorts show arrow and priority number
- ✅ Filters and sorts work together correctly
- ✅ Existing filters (year, date range, amount, accounts) still work
- ✅ Text filters work for Notes column

### Types:
- ✅ All filter/sort state is properly typed
- ✅ No `any` types used
- ✅ Type-safe column field references
- ✅ Proper TypeScript interfaces for all data structures

### Performance:
- ✅ Filtering 1000+ rows performs smoothly (<100ms)
- ✅ Cascading sort performs efficiently
- ✅ Filter value extraction is memoized
- ✅ No unnecessary re-renders

### UX:
- ✅ Dropdown matches Excel-style appearance
- ✅ Glass design system styling applied
- ✅ Light/dark mode support
- ✅ Clear visual feedback for active filters/sorts
- ✅ Intuitive interaction patterns
- ✅ Helpful tooltips/instructions

## Risks & Mitigations

### Risk: Performance with large datasets
- **Mitigation**: Memoize filter value extraction, use efficient algorithms, consider virtualization for very large lists

### Risk: Complex state management
- **Mitigation**: Use well-structured types, separate concerns (filters vs sorts), comprehensive testing

### Risk: Breaking existing functionality
- **Mitigation**: Maintain backward compatibility, test existing filters thoroughly, gradual migration

### Risk: UI complexity overwhelming users
- **Mitigation**: Clear visual indicators, intuitive defaults, helpful tooltips, progressive disclosure

### Risk: Accessibility issues
- **Mitigation**: Follow ARIA patterns, keyboard navigation, screen reader testing, focus management

### Risk: Mobile responsiveness
- **Mitigation**: Test on mobile devices, responsive design patterns, touch-friendly targets

## Technical Notes

### Column Field Mapping
- Date: `projection_date`
- Year: derived from `projection_date`
- Time: `entry_time`
- Days Remaining: `days_remaining`
- Account columns: `account_balances[accountId]`
- Total: `total_available`
- Bills Remaining: `bills_remaining`
- Cash Available: `cash_available`
- Cash per Week: `cash_per_week`
- Spending per Day: `spending_per_day`
- Notes: `notes`

### Filter Types by Column
- **Value Selection** (checkbox): Date, Year, Time, Account columns
- **Text Filter**: Notes
- **Range Filter** (future): Days Remaining, Total, Bills Remaining, Cash Available, Cash per Week, Spending per Day

### Sort Priority Logic
- First sort rule added = Priority 1 (primary)
- Subsequent rules = Priority 2, 3, etc. (secondary, tertiary)
- User can reorder by removing and re-adding
- Maximum 3-4 sort levels (reasonable limit)

### Integration with Existing Filters
- New column filters are AND-ed with existing filters
- Existing filters (year, date range, amount, accounts) remain in separate UI
- All filters work together seamlessly
