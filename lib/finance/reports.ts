// lib/finance/reports.ts

import { ParsedTransaction, FinancialSummary } from './types';

function esc(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csv(rows: (string | number)[][]): string {
  return rows.map(row => row.join(',')).join('\n');
}

export function generateNLReport(transactions: ParsedTransaction[], summary: FinancialSummary): string {
  return csv([
    ['Amsterdam Parent Project - NL BTW/P&L Rapport'],
    [`Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`],
    [],
    ['=== WINST- EN VERLIESREKENING ==='],
    [],
    ['OMZET'],
    ['Events (Eventbrite/Luma)', summary.income.events.toFixed(2)],
    ['Programs (Stripe/Direct)', summary.income.programs.toFixed(2)],
    ['Overig', summary.income.other.toFixed(2)],
    ['Totale Bruto Omzet', summary.income.total.toFixed(2)],
    ['BTW op Omzet (21%)', summary.income.vatOnIncome.toFixed(2)],
    ['Netto Omzet (excl. BTW)', summary.income.netIncome.toFixed(2)],
    [],
    ['KOSTEN'],
    ['Programma Operaties', summary.expenses.programOperations.toFixed(2)],
    ['Technologie', summary.expenses.technology.toFixed(2)],
    ['Bedrijfsadministratie', summary.expenses.businessAdmin.toFixed(2)],
    ['Totale Bruto Kosten', summary.expenses.total.toFixed(2)],
    ['BTW op Kosten (terug te vorderen)', summary.expenses.vatOnExpenses.toFixed(2)],
    ['Netto Kosten (excl. BTW)', summary.expenses.netExpenses.toFixed(2)],
    [],
    ['NETTORESULTAAT', summary.result.netResult.toFixed(2)],
    [],
    ['=== BTW-AANGIFTE ==='],
    ['BTW op Omzet (af te dragen)', summary.income.vatOnIncome.toFixed(2)],
    ['BTW op Kosten (terug te vorderen)', summary.expenses.vatOnExpenses.toFixed(2)],
    ['Netto BTW Te Betalen/(Terug te ontvangen)', summary.result.netVatPayable.toFixed(2)],
    [],
    ['=== TRANSACTIES ==='],
    ['Datum', 'Omschrijving', 'Categorie', 'Af/Bij', 'Bedrag (EUR)', 'BTW'],
    ...transactions.map(tx => [
      tx.date,
      esc(tx.description),
      tx.category ?? 'Other',
      tx.isIncome ? 'Bij' : 'Af',
      tx.amount.toFixed(2),
      tx.vatAmount.toFixed(2),
    ]),
  ]);
}

export function generateUSReport(transactions: ParsedTransaction[], summary: FinancialSummary): string {
  return csv([
    ['Amsterdam Parent Project - US Tax Report'],
    [`Generated: ${new Date().toLocaleDateString('en-US')}`],
    ['Note: All amounts in EUR. Convert to USD using IRS yearly average exchange rate.'],
    ['IRS rates: https://www.irs.gov/individuals/international-taxpayers/yearly-average-currency-exchange-rates'],
    [],
    ['=== INCOME & EXPENSE SUMMARY ==='],
    [],
    ['GROSS INCOME'],
    ['Events', summary.income.events.toFixed(2)],
    ['Programs', summary.income.programs.toFixed(2)],
    ['Other Income', summary.income.other.toFixed(2)],
    ['Total Gross Income', summary.income.total.toFixed(2)],
    [],
    ['DEDUCTIBLE BUSINESS EXPENSES'],
    ['Program Operations', summary.expenses.programOperations.toFixed(2)],
    ['Technology (Software & Services)', summary.expenses.technology.toFixed(2)],
    ['Business Administration', summary.expenses.businessAdmin.toFixed(2)],
    ['Total Expenses', summary.expenses.total.toFixed(2)],
    [],
    ['NET PROFIT / (LOSS)', summary.result.netResult.toFixed(2)],
    [],
    ['Note: Dutch BTW (VAT) is not deductible for US purposes — report gross figures above.'],
    [],
    ['=== TRANSACTIONS ==='],
    ['Date', 'Description', 'Category', 'Type', 'Amount (EUR)'],
    ...transactions.map(tx => [
      tx.date,
      esc(tx.description),
      tx.category ?? 'Other',
      tx.isIncome ? 'Income' : 'Expense',
      tx.isIncome ? tx.amount.toFixed(2) : `-${tx.amount.toFixed(2)}`,
    ]),
  ]);
}

export function triggerDownload(content: string, filename: string): void {
  // BOM prefix ensures Excel opens UTF-8 correctly
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
