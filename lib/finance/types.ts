// lib/finance/types.ts
type Category = 'Events' | 'Programs' | 'Program Operations' | 'Technology' | 'Business Admin' | 'Personal Contribution' | 'Other';

export interface ParsedTransaction {
  date: string;
  description: string;
  account: string;
  counterparty: string;
  code: string;
  debitCredit: 'D' | 'C';
  amount: number;
  transactionType: string;
  resultingBalance: number;
  category?: Category;
  isIncome: boolean;
  vatAmount: number;
}

export interface CategoryMapping {
  keyword: string;
  category: Category;
  isIncome: boolean;
}

export interface FinancialSummary {
  income: {
    events: number;
    programs: number;
    personalContribution: number;
    other: number;
    total: number;
    vatOnIncome: number;
    netIncome: number;
  };
  expenses: {
    programOperations: number;
    technology: number;
    businessAdmin: number;
    total: number;
    vatOnExpenses: number;
    netExpenses: number;
  };
  result: {
    netResult: number;
    netVatPayable: number;
  };
}

export interface ParsedCSVData {
  transactions: ParsedTransaction[];
  summary: FinancialSummary;
  parseDate: string;
}