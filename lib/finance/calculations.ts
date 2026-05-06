// lib/finance/calculations.ts

import { ParsedTransaction, FinancialSummary } from './types';

export function calculateSummary(transactions: ParsedTransaction[]): FinancialSummary {
  let incomeEvents = 0;
  let incomePrograms = 0;
  let incomePersonalContribution = 0;
  let incomeOther = 0;
  let expensesProgramOps = 0;
  let expensesTechnology = 0;
  let expensesBusinessAdmin = 0;
  let totalVatOnIncome = 0;
  let totalVatOnExpenses = 0;

  for (const tx of transactions) {
    const { amount, category, isIncome, vatAmount } = tx;

    if (isIncome) {
      totalVatOnIncome += vatAmount;
      
      if (category === 'Events') {
        incomeEvents += amount;
      } else if (category === 'Programs') {
        incomePrograms += amount;
      } else if (category === 'Personal Contribution') {
        incomePersonalContribution += amount;
      } else {
        incomeOther += amount;
      }
    } else {
      if (category === 'Program Operations') {
        expensesProgramOps += amount;
      } else if (category === 'Technology') {
        expensesTechnology += amount;
        totalVatOnExpenses += vatAmount;
      } else if (category === 'Business Admin') {
        expensesBusinessAdmin += amount;
        totalVatOnExpenses += vatAmount;
      } else {
        // Other expenses with VAT
        totalVatOnExpenses += vatAmount;
      }
    }
  }

  const totalIncome = incomeEvents + incomePrograms + incomePersonalContribution + incomeOther;
  const totalExpenses = expensesProgramOps + expensesTechnology + expensesBusinessAdmin;
  
  const netIncome = totalIncome - totalVatOnIncome;
  const netExpenses = totalExpenses - totalVatOnExpenses;
  
  const netResult = netIncome - netExpenses;
  const netVatPayable = totalVatOnIncome - totalVatOnExpenses;

  return {
    income: {
      events: incomeEvents,
      programs: incomePrograms,
      personalContribution: incomePersonalContribution,
      other: incomeOther,
      total: totalIncome,
      vatOnIncome: totalVatOnIncome,
      netIncome,
    },
    expenses: {
      programOperations: expensesProgramOps,
      technology: expensesTechnology,
      businessAdmin: expensesBusinessAdmin,
      total: totalExpenses,
      vatOnExpenses: totalVatOnExpenses,
      netExpenses,
    },
    result: {
      netResult,
      netVatPayable,
    },
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function formatDate(dateStr: string): string {
  // ING CSV uses YYYYMMDD — new Date() can't parse this without dashes
  if (/^\d{8}$/.test(dateStr)) {
    const iso = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    return new Date(iso).toLocaleDateString('nl-NL');
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('nl-NL');
}