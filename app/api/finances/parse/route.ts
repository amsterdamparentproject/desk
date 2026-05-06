// app/api/finances/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/finance/parser';
import { calculateSummary } from '@/lib/finance/calculations';
import { ParsedCSVData } from '@/lib/finance/types';

export async function POST(request: NextRequest) {
  try {
    const { csvText } = await request.json();

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'Invalid CSV data' }, { status: 400 });
    }

    // Parse CSV
    const transactions = parseCSV(csvText);

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No valid transactions found in CSV' }, { status: 400 });
    }

    // Calculate summary
    const summary = calculateSummary(transactions);

    const result: ParsedCSVData = {
      transactions,
      summary,
      parseDate: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      { error: 'Failed to parse CSV file' },
      { status: 500 }
    );
  }
}