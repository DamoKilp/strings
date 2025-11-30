import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import ExcelJS from 'exceljs'
import { bulkInsertProjections, getAccounts, type FinanceProjection, type FinanceAccount } from '@/app/actions/finance'

export const maxDuration = 60 // 60 seconds for large file uploads

interface ParsedRow {
  daysRemaining?: number
  year?: number
  month?: string
  accountBalances: Record<string, number>
  billsRemaining?: number
  notes?: string
}

/**
 * Parse month string to date (e.g., "Oct" -> "2024-10-01")
 * Uses provided year
 */
function parseMonthToDate(monthStr: string, year: number = new Date().getFullYear()): string | null {
  if (!monthStr) return null
  
  const monthNames: Record<string, number> = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
  }
  
  const monthLower = monthStr.toLowerCase().trim()
  const monthNum = monthNames[monthLower]
  
  if (!monthNum) {
    // Try parsing as date string
    const date = new Date(monthStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    return null
  }
  
  // Use first day of month
  return `${year}-${String(monthNum).padStart(2, '0')}-01`
}

/**
 * Map Excel account column names to account IDs
 */
function mapAccountColumns(
  headers: string[],
  accounts: FinanceAccount[]
): Map<string, string> {
  const mapping = new Map<string, string>()
  
  // Create a map of account names (case-insensitive) to account IDs
  const accountMap = new Map<string, string>()
  accounts.forEach(account => {
    accountMap.set(account.name.toLowerCase(), account.id)
  })
  
  // Map headers to account IDs
  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase().trim()
    const account = accounts.find(acc => 
      acc.name.toLowerCase() === headerLower ||
      headerLower.includes(acc.name.toLowerCase()) ||
      acc.name.toLowerCase().includes(headerLower)
    )
    
    if (account) {
      mapping.set(header, account.id)
    }
  })
  
  return mapping
}

/**
 * Parse Excel/CSV file and extract financial projections
 */
function parseFinancialData(
  workbook: ExcelJS.Workbook,
  accounts: FinanceAccount[]
): { 
  rows: ParsedRow[]
  summary: {
    totalRows: number
    validRows: number
    skippedRows: number
    columnsFound: {
      daysRemaining: boolean
      year: boolean
      month: boolean
      billsRemaining: boolean
      notes: boolean
      accountColumns: number
    }
  }
} {
  const rows: ParsedRow[] = []
  const worksheet = workbook.worksheets[0]
  
  if (!worksheet) {
    return { rows: [], summary: { totalRows: 0, validRows: 0, skippedRows: 0, columnsFound: { daysRemaining: false, year: false, month: false, billsRemaining: false, notes: false, accountColumns: 0 } } }
  }
  
  // Convert worksheet to array of arrays
  const jsonData: unknown[][] = []
  worksheet.eachRow((row, rowNumber) => {
    const rowData: unknown[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Get cell value, handling different types
      let value: unknown = null
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          value = (cell.value as { text: string }).text
        } else if (typeof cell.value === 'object' && 'result' in cell.value) {
          value = (cell.value as { result: unknown }).result
        } else {
          value = cell.value
        }
      }
      rowData[colNumber - 1] = value // ExcelJS is 1-indexed
    })
    jsonData.push(rowData)
  })
  
  if (jsonData.length < 2) {
    return { rows: [], summary: { totalRows: 0, validRows: 0, skippedRows: 0, columnsFound: { daysRemaining: false, year: false, month: false, billsRemaining: false, notes: false, accountColumns: 0 } } }
  }
  
  const headers = (jsonData[0] as string[]).map(h => String(h || '').trim())
  
  // Find column indices
  const daysRemainingIndex = headers.findIndex(h => 
    /days?\s*remaining/i.test(h)
  )
  const yearIndex = headers.findIndex(h => 
    /^year$/i.test(h)
  )
  const monthIndex = headers.findIndex(h => 
    /month/i.test(h) && !/remaining/i.test(h)
  )
  const billsRemainingIndex = headers.findIndex(h => 
    /bills?\s*remaining/i.test(h)
  )
  const notesIndex = headers.findIndex(h => 
    /notes?/i.test(h)
  )
  
  // Map account columns (exclude known system columns)
  const systemColumns = new Set([
    daysRemainingIndex,
    yearIndex,
    monthIndex,
    billsRemainingIndex,
    notesIndex
  ].filter(idx => idx >= 0))
  
  const accountColumnMapping = mapAccountColumns(
    headers.filter((_, idx) => !systemColumns.has(idx)),
    accounts
  )
  
  const summary = {
    totalRows: jsonData.length - 1, // Exclude header
    validRows: 0,
    skippedRows: 0,
    columnsFound: {
      daysRemaining: daysRemainingIndex >= 0,
      year: yearIndex >= 0,
      month: monthIndex >= 0,
      billsRemaining: billsRemainingIndex >= 0,
      notes: notesIndex >= 0,
      accountColumns: accountColumnMapping.size
    }
  }
  
  // Process data rows
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as unknown[]
    if (!row || row.length === 0) continue
    
    // Extract account balances
    const accountBalances: Record<string, number> = {}
    headers.forEach((header, colIndex) => {
      if (systemColumns.has(colIndex)) return
      
      const accountId = accountColumnMapping.get(header)
      if (accountId) {
        const value = row[colIndex]
        if (value !== null && value !== undefined && value !== '') {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
          if (!isNaN(numValue)) {
            accountBalances[accountId] = numValue
          }
        }
      }
    })
    
    // Extract other fields
    const daysRemaining = daysRemainingIndex >= 0 && row[daysRemainingIndex] !== null
      ? parseInt(String(row[daysRemainingIndex])) 
      : undefined
    
    let year: number | undefined = undefined
    if (yearIndex >= 0 && row[yearIndex] !== null && row[yearIndex] !== '') {
      const yearValue = row[yearIndex]
      if (typeof yearValue === 'number') {
        year = yearValue
      } else {
        const yearStr = String(yearValue).trim()
        const parsedYear = parseInt(yearStr)
        if (!isNaN(parsedYear)) {
          year = parsedYear
        }
      }
    }
    
    const month = monthIndex >= 0 && row[monthIndex] !== null && row[monthIndex] !== ''
      ? String(row[monthIndex]).trim()
      : undefined
    
    const billsRemaining = billsRemainingIndex >= 0 && row[billsRemainingIndex] !== null
      ? parseFloat(String(row[billsRemainingIndex]).replace(/[^0-9.-]/g, ''))
      : undefined
    
    const notes = notesIndex >= 0 && row[notesIndex] !== null
      ? String(row[notesIndex]).trim()
      : undefined
    
    // Skip rows with no essential data
    if (daysRemaining === undefined && !month) {
      summary.skippedRows++
      continue
    }
    
    rows.push({
      daysRemaining,
      year,
      month,
      accountBalances,
      billsRemaining,
      notes
    })
    summary.validRows++
  }
  
  return { rows, summary }
}

/**
 * Convert parsed rows to FinanceProjection format
 */
function convertToProjections(
  rows: ParsedRow[],
  accounts: FinanceAccount[]
): { 
  projections: Array<Partial<FinanceProjection> & { projection_date: string; days_remaining: number; account_balances: Record<string, number>; total_available: number; bills_remaining: number; cash_available: number }>
  summary: {
    total: number
    successful: number
    failed: number
    dateIssues: number
    missingMonth: number
    invalidYear: number
  }
} {
  const currentYear = new Date().getFullYear()
  const projections: Array<Partial<FinanceProjection> & { projection_date: string; days_remaining: number; account_balances: Record<string, number>; total_available: number; bills_remaining: number; cash_available: number }> = []
  
  const summary = {
    total: rows.length,
    successful: 0,
    failed: 0,
    dateIssues: 0,
    missingMonth: 0,
    invalidYear: 0
  }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    try {
      // Determine projection date - use year from row if provided, otherwise current year
      let yearToUse = currentYear
      if (row.year !== undefined && row.year !== null) {
        const yearNum = typeof row.year === 'number' ? row.year : parseInt(String(row.year))
        if (!isNaN(yearNum) && yearNum > 2000 && yearNum < 2100) {
          yearToUse = yearNum
        } else {
          summary.invalidYear++
        }
      }
      
      let projectionDate: string | null = null
      
      if (row.month) {
        const monthStr = String(row.month).trim()
        projectionDate = parseMonthToDate(monthStr, yearToUse)
        if (!projectionDate) {
          summary.dateIssues++
          // Fallback to first day of current month/year if parsing fails
          projectionDate = `${yearToUse}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
        }
      } else {
        summary.missingMonth++
        // Use first day of current month if month not provided
        const currentMonth = new Date().getMonth() + 1
        projectionDate = `${yearToUse}-${String(currentMonth).padStart(2, '0')}-01`
      }
    
      // Determine days remaining
      let daysRemaining = row.daysRemaining
      if (daysRemaining === undefined || isNaN(daysRemaining)) {
        // Calculate from month if available
        const date = new Date(projectionDate)
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        lastDayOfMonth.setHours(0, 0, 0, 0)
        daysRemaining = Math.max(0, Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
      }
      
      // Calculate totals automatically
      const totalAvailable = Object.values(row.accountBalances).reduce((sum, val) => sum + val, 0)
      const billsRemaining = row.billsRemaining || 0
      const cashAvailable = totalAvailable - billsRemaining
      
      // Calculate derived values
      const weeksRemaining = daysRemaining > 0 ? daysRemaining / 7 : 0
      const cashPerWeek = weeksRemaining > 0 ? cashAvailable / weeksRemaining : null
      const spendingPerDay = daysRemaining > 0 ? cashAvailable / daysRemaining : null
      
      // Generate unique entry_time to avoid conflicts
      // Use row index to ensure uniqueness (increment seconds, handle overflow)
      const baseTime = new Date()
      const secondsOffset = i % 60 // Use row index to vary seconds (0-59)
      const totalSeconds = baseTime.getSeconds() + secondsOffset
      const finalSeconds = totalSeconds % 60 // Ensure seconds stay in valid range (0-59)
      const minutesCarry = Math.floor(totalSeconds / 60)
      const finalMinutes = (baseTime.getMinutes() + minutesCarry) % 60
      const hoursCarry = Math.floor((baseTime.getMinutes() + minutesCarry) / 60)
      const finalHours = (baseTime.getHours() + hoursCarry) % 24
      const entryTime = `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}:${finalSeconds.toString().padStart(2, '0')}`
      
      const projection = {
        projection_date: projectionDate,
        days_remaining: daysRemaining,
        entry_time: entryTime,
        account_balances: row.accountBalances,
        total_available: totalAvailable,
        bills_remaining: billsRemaining,
        cash_available: cashAvailable,
        cash_per_week: cashPerWeek ? Math.round(cashPerWeek * 100) / 100 : null,
        spending_per_day: spendingPerDay ? Math.round(spendingPerDay * 100) / 100 : null,
        notes: row.notes || null,
      }
      
      projections.push(projection)
      summary.successful++
    } catch (error) {
      summary.failed++
      console.error(`[IMPORT] Failed to convert row ${i + 1}:`, error)
    }
  }
  
  return { projections, summary }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get form data
    const form = await req.formData()
    const file = form.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Validate file type
    const fileName = file.name.toLowerCase()
    const isValidFile = fileName.endsWith('.xlsx') || 
                       fileName.endsWith('.xls') || 
                       fileName.endsWith('.csv')
    
    if (!isValidFile) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.' 
      }, { status: 400 })
    }
    
    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    
    // Get accounts for mapping
    const accountsResult = await getAccounts()
    if (accountsResult.error || !accountsResult.data) {
      return NextResponse.json({ 
        error: 'Failed to load accounts. Please ensure you have accounts set up.' 
      }, { status: 500 })
    }
    
    // Parse data
    const parseResult = parseFinancialData(workbook, accountsResult.data)
    const { rows: parsedRows, summary: parseSummary } = parseResult
    
    console.log('[IMPORT SUMMARY] File Parsing:')
    console.log(`  - Total rows in file: ${parseSummary.totalRows}`)
    console.log(`  - Valid rows extracted: ${parseSummary.validRows}`)
    console.log(`  - Skipped rows: ${parseSummary.skippedRows}`)
    console.log(`  - Columns found:`)
    console.log(`    * Days Remaining: ${parseSummary.columnsFound.daysRemaining ? '✓' : '✗'}`)
    console.log(`    * Year: ${parseSummary.columnsFound.year ? '✓' : '✗'}`)
    console.log(`    * Month: ${parseSummary.columnsFound.month ? '✓' : '✗'}`)
    console.log(`    * Bills Remaining: ${parseSummary.columnsFound.billsRemaining ? '✓' : '✗'}`)
    console.log(`    * Notes: ${parseSummary.columnsFound.notes ? '✓' : '✗'}`)
    console.log(`    * Account columns: ${parseSummary.columnsFound.accountColumns}`)
    
    if (parsedRows.length === 0) {
      return NextResponse.json({ 
        error: 'No valid data found in file. Please check the file format.',
        details: parseSummary
      }, { status: 400 })
    }
    
    // Convert to projections
    const conversionResult = convertToProjections(parsedRows, accountsResult.data)
    const { projections, summary: conversionSummary } = conversionResult
    
    console.log('[IMPORT SUMMARY] Data Conversion:')
    console.log(`  - Total rows processed: ${conversionSummary.total}`)
    console.log(`  - Successfully converted: ${conversionSummary.successful}`)
    console.log(`  - Failed conversions: ${conversionSummary.failed}`)
    if (conversionSummary.dateIssues > 0) {
      console.log(`  - Date parsing issues: ${conversionSummary.dateIssues}`)
    }
    if (conversionSummary.missingMonth > 0) {
      console.log(`  - Missing month (using current date): ${conversionSummary.missingMonth}`)
    }
    if (conversionSummary.invalidYear > 0) {
      console.log(`  - Invalid year (using current year): ${conversionSummary.invalidYear}`)
    }
    // Log sample of first few parsed rows and converted projections
    if (parsedRows.length > 0) {
      console.log(`  - Sample parsed row:`, {
        year: parsedRows[0].year,
        month: parsedRows[0].month,
        daysRemaining: parsedRows[0].daysRemaining,
        yearType: typeof parsedRows[0].year
      })
    }
    if (projections.length > 0) {
      console.log(`  - Sample projection:`, {
        projection_date: projections[0].projection_date,
        days_remaining: projections[0].days_remaining,
        entry_time: projections[0].entry_time
      })
    }
    
    if (projections.length === 0) {
      return NextResponse.json({ 
        error: 'No valid projections could be created from the data.',
        details: conversionSummary
      }, { status: 400 })
    }
    
    // Bulk insert
    const result = await bulkInsertProjections(projections)
    
    if (result.error) {
      return NextResponse.json({ 
        error: result.error,
        inserted: result.inserted,
        skipped: result.skipped
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      total: projections.length,
      message: `Successfully imported ${result.inserted} projection(s). ${result.skipped > 0 ? `${result.skipped} duplicate(s) skipped.` : ''}`
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to import file' 
    }, { status: 500 })
  }
}

