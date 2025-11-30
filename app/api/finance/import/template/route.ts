import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import ExcelJS from 'exceljs'
import { getAccounts } from '@/app/actions/finance'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's accounts
    const accountsResult = await getAccounts()
    if (accountsResult.error || !accountsResult.data) {
      return NextResponse.json({ 
        error: 'Failed to load accounts' 
      }, { status: 500 })
    }
    
    const accounts = accountsResult.data
    
    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Financial Data')
    
    const currentYear = new Date().getFullYear()
    
    // Create instructions row
    const instructions = [
      'INSTRUCTIONS:',
      '',
      '',
      ...accounts.map(() => ''),
      '',
      '',
      '',
      '',
      ''
    ]
    
    const instructionDetails = [
      '1. Fill in Days Remaining (number of days left in the month)',
      '2. Enter Year (e.g., 2024, 2025)',
      '3. Enter Month (e.g., "Oct", "November", "Dec")',
      ...accounts.map((acc, idx) => idx === 0 ? `4. Enter balance for ${acc.name} and other accounts` : ''),
      '5. Enter Bills Remaining amount (required)',
      '6. Total, Cash Available, and Cash per week will be calculated automatically',
      '7. Add any notes in the Notes column (optional)'
    ]
    
    // Define headers
    const headers = [
      'Days Remaining',
      'Year',
      'Month',
      ...accounts.map(acc => acc.name), // Dynamic account columns
      'Bills Remaining (enter manually)',
      'Notes'
    ]
    
    // Create sample data rows (2 examples)
    const sampleRows = [
      [
        21,                    // Days Remaining
        currentYear,           // Year
        'Oct',                 // Month
        ...accounts.map(() => 0), // Account balances (all 0 for template)
        0,                     // Bills Remaining
        ''                     // Notes
      ],
      [
        10,                    // Days Remaining
        currentYear,           // Year
        'Nov',                 // Month
        ...accounts.map(() => 0), // Account balances
        0,                     // Bills Remaining
        'Example entry'        // Notes
      ]
    ]
    
    // Add all rows: instructions, instruction details, blank row, headers, sample rows
    worksheet.addRow(instructions)
    worksheet.addRow(instructionDetails)
    worksheet.addRow([]) // Blank row
    worksheet.addRow(headers)
    sampleRows.forEach(row => worksheet.addRow(row))
    
    // Set column widths for better readability
    worksheet.getColumn(1).width = 15  // Days Remaining
    worksheet.getColumn(2).width = 10  // Year
    worksheet.getColumn(3).width = 12  // Month
    accounts.forEach((_, idx) => {
      worksheet.getColumn(4 + idx).width = 15 // Account columns
    })
    worksheet.getColumn(4 + accounts.length).width = 25  // Bills Remaining
    worksheet.getColumn(5 + accounts.length).width = 30  // Notes
    
    // Style header row (row 4, 1-indexed = 4)
    const headerRow = worksheet.getRow(4)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    
    // Style instructions row (row 1, 1-indexed = 1)
    const instructionRow = worksheet.getRow(1)
    const instructionCell = instructionRow.getCell(1)
    instructionCell.font = { bold: true, size: 12 }
    
    // Generate Excel file buffer
    const excelBuffer = await workbook.xlsx.writeBuffer()
    
    // Return file as download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="finance-import-template-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
    
  } catch (error) {
    console.error('Template generation error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate template' 
    }, { status: 500 })
  }
}

