import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import * as XLSX from 'xlsx'
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
    const workbook = XLSX.utils.book_new()
    
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
    
    // Combine all rows: instructions, blank row, instruction details, blank row, headers, sample rows
    const data = [
      instructions,
      instructionDetails,
      [], // Blank row
      headers,
      ...sampleRows
    ]
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 15 },  // Days Remaining
      { wch: 10 },  // Year
      { wch: 12 },  // Month
      ...accounts.map(() => ({ wch: 15 })), // Account columns
      { wch: 25 },  // Bills Remaining
      { wch: 30 }   // Notes
    ]
    worksheet['!cols'] = colWidths
    
    // Style header row (row 4, 0-indexed = 3)
    const headerRowIndex = 3
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col })
      if (!worksheet[cellAddress]) continue
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E0E0E0' } }
      }
    }
    
    // Style instructions row (row 1, 0-indexed = 0)
    const instructionCell = XLSX.utils.encode_cell({ r: 0, c: 0 })
    if (worksheet[instructionCell]) {
      worksheet[instructionCell].s = {
        font: { bold: true, sz: 12 }
      }
    }
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Data')
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    })
    
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

