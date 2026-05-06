// lib/finance/parser.ts

import { ParsedTransaction, CategoryMapping } from './types';

const DEFAULT_CATEGORIES: CategoryMapping[] = [
  // Income - Events
  { keyword: 'eventbrite', category: 'Events', isIncome: true },
  { keyword: 'luma', category: 'Events', isIncome: true },
  
  // Income - Programs
  { keyword: 'stripe', category: 'Programs', isIncome: true },
  { keyword: 'amsterdam parent', category: 'Programs', isIncome: true },

  // Expenses - Program Operations
  { keyword: 'amsterdam nld', category: 'Program Operations', isIncome: false },
  
  // Expenses - Technology
  { keyword: 'anthropic', category: 'Technology', isIncome: false },
  { keyword: 'claude pro', category: 'Technology', isIncome: false },
  { keyword: 'google', category: 'Technology', isIncome: false },
  { keyword: 'netlify', category: 'Technology', isIncome: false },
  { keyword: 'github', category: 'Technology', isIncome: false },
  { keyword: 'supabase', category: 'Technology', isIncome: false },
  { keyword: 'canva', category: 'Technology', isIncome: false },
  
  // Expenses - Business Admin
  { keyword: 'ing', category: 'Business Admin', isIncome: false },
  { keyword: 'bank', category: 'Business Admin', isIncome: false },
  { keyword: 'moneybird', category: 'Business Admin', isIncome: false},
  { keyword: 'xl administratie', category: 'Business Admin', isIncome: false},

  // Donations & seed funding
  { keyword: 'siega', category: 'Personal Contribution', isIncome: false},
];

export function parseCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.trim().split('\n');
  const transactions: ParsedTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const transaction = parseCSVLine(line);
      if (transaction) {
        transactions.push(transaction);
      }
    } catch (error) {
      console.error(`Error parsing line ${i}:`, error);
      continue;
    }
  }

  return transactions;
}

function parseCSVLine(line: string): ParsedTransaction | null {
  // Handle semicolon-delimited CSV with quoted fields
  const fields = parseQuotedCSV(line);
  
  if (fields.length < 11) {
    return null;
  }

  const [date, description, account, counterparty, code, debitCredit, amountStr, transactionType, notifications, balanceStr] = fields;

  // ING uses European number format: period = thousands separator, comma = decimal
  const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
  const balance = parseFloat(balanceStr.replace(/\./g, '').replace(',', '.'));

  if (isNaN(amount)) {
    return null;
  }

  // ING uses Dutch: "Bij" = credit (income), "Af" = debit (expense)
  const isIncome = ['c', 'bij', 'credit'].includes(debitCredit.toLowerCase());
  const { category, vatAmount } = categorizeTransaction(description, isIncome, Math.abs(amount));

  return {
    date,
    description,
    account,
    counterparty,
    code,
    debitCredit: debitCredit.toUpperCase() as 'D' | 'C',
    amount: Math.abs(amount),
    transactionType,
    resultingBalance: balance,
    category,
    isIncome,
    vatAmount,
  };
}

function parseQuotedCSV(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim().replace(/^"|"$/g, ''));
  return fields;
}

function categorizeTransaction(description: string, isIncome: boolean, amount: number): { category: ParsedTransaction['category']; vatAmount: number } {
  const lowerDesc = description.toLowerCase();

  // Find matching category
  let category: ParsedTransaction['category'] = 'Other';
  for (const mapping of DEFAULT_CATEGORIES) {
    if (lowerDesc.includes(mapping.keyword)) {
      category = mapping.category;
      break;
    }
  }
  
  // For 2025: Categorize direct transfers above a certain amount or refunds as 'Programs'; otherwise 'Other'
  if (category === 'Other' && (amount >= 40 || amount < 0)) {
    category = 'Programs'
  }

  const vatRate = 0.21;
  const vatAmount = amount * (vatRate / (1 + vatRate)); // Extract VAT from gross amount

  return { category, vatAmount };
}

export function getDefaultCategories(): CategoryMapping[] {
  return DEFAULT_CATEGORIES;
}