// app/finances/page.tsx

'use client';

import { useState } from 'react';
import { ParsedCSVData, ParsedTransaction, FinancialSummary } from '@/lib/finance/types';
import { formatCurrency, formatDate, calculateSummary } from '@/lib/finance/calculations';
// pdf-reports is loaded dynamically — it's browser-only and large;

const CATEGORIES: ParsedTransaction['category'][] = [
  'Events', 'Programs', 'Personal Contribution', 'Program Operations', 'Technology', 'Business Admin', 'Other',
];

export default function FinancesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ParsedCSVData | null>(null);
  const [overrides, setOverrides] = useState<Record<number, ParsedTransaction['category']>>({});
  const [error, setError] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState<'nl' | 'us' | null>(null);

  // Apply category overrides and recalculate summary live
  const transactions = (data?.transactions ?? []).map((tx, i) =>
    overrides[i] !== undefined ? { ...tx, category: overrides[i] } : tx
  );
  const summary: FinancialSummary | null = data ? calculateSummary(transactions) : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const csvText = await file.text();
      const response = await fetch('/api/finances/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse CSV');
      }

      const result: ParsedCSVData = await response.json();
      setData(result);
      setOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (index: number, category: ParsedTransaction['category']) => {
    setOverrides(prev => ({ ...prev, [index]: category }));
  };

  const handleDownloadNL = async () => {
    if (!summary || generatingPDF) return;
    setGeneratingPDF('nl');
    try {
      const { downloadNLPDF } = await import('@/lib/finance/pdf-reports');
      await downloadNLPDF(transactions, summary);
    } finally {
      setGeneratingPDF(null);
    }
  };

  const handleDownloadUS = async () => {
    if (!summary || generatingPDF) return;
    setGeneratingPDF('us');
    try {
      const { downloadUSPDF } = await import('@/lib/finance/pdf-reports');
      await downloadUSPDF(transactions, summary);
    } finally {
      setGeneratingPDF(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Financial Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">Amsterdam Parent Project</p>
          </div>
          {summary && (
            <div className="flex gap-2">
              <button
                onClick={handleDownloadNL}
                disabled={!!generatingPDF}
                className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
              >
                {generatingPDF === 'nl' ? 'Generating…' : 'Download NL Report'}
              </button>
              <button
                onClick={handleDownloadUS}
                disabled={!!generatingPDF}
                className="px-4 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
              >
                {generatingPDF === 'us' ? 'Generating…' : 'Download US Report'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Import ING Statement</h2>
            <p className="text-sm text-slate-600">Upload your ING CSV export to generate P&L, VAT calculations, and downloadable tax reports.</p>
          </div>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 hover:border-slate-400 transition-colors">
              <input type="file" accept=".csv" onChange={handleFileChange} className="w-full" />
              {file && (
                <p className="text-sm text-slate-600 mt-2">
                  Selected: <span className="font-medium text-slate-900">{file.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Parsing...' : 'Parse CSV & Calculate'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {data && summary && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Income"
                value={summary.income.total}
                subtext={`Net ex-VAT: ${formatCurrency(summary.income.netIncome)}`}
                accent="bg-green-50 border-green-200"
              />
              <StatCard
                label="Total Expenses"
                value={summary.expenses.total}
                subtext={`Net ex-VAT: ${formatCurrency(summary.expenses.netExpenses)}`}
                accent="bg-red-50 border-red-200"
              />
              <StatCard
                label="Net Result"
                value={summary.result.netResult}
                subtext={`VAT Payable: ${formatCurrency(summary.result.netVatPayable)}`}
                accent={summary.result.netResult >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}
              />
            </div>

            {/* P&L Statement */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Profit & Loss Statement</h3>
              <PLStatement summary={summary} />
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Transactions ({transactions.length})
                </h3>
                <p className="text-xs text-slate-500">Change a category to update the report live</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Description</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Category</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Type</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-600">Amount</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-600">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-2 text-slate-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="py-3 px-2 text-slate-700 max-w-xs truncate">{tx.description}</td>
                        <td className="py-3 px-2">
                          <select
                            value={tx.category ?? 'Other'}
                            onChange={e => handleCategoryChange(i, e.target.value as ParsedTransaction['category'])}
                            className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${getCategoryColor(tx.category)}`}
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${tx.isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {tx.isIncome ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-slate-900">
                          {tx.isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-600">{formatCurrency(tx.vatAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* VAT Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <p className="text-sm text-amber-900">
                <strong>VAT Filing:</strong> Your final VAT return is due by end of July 2025 (for April–June quarter). After 1 July, KOR exempts you from VAT registration.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, accent }: {
  label: string; value: number; subtext: string; accent: string;
}) {
  return (
    <div className={`rounded-xl border p-6 ${accent}`}>
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{formatCurrency(value)}</p>
      <p className="text-xs text-slate-600 mt-2">{subtext}</p>
    </div>
  );
}

function PLStatement({ summary }: { summary: FinancialSummary }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Income</h4>
        <div className="space-y-2 text-sm">
          <Row label="Events (Eventbrite/Luma)" value={summary.income.events} />
          <Row label="Programs (Stripe/Direct)" value={summary.income.programs} />
          <Row label="Personal Contributions" value={summary.income.personalContribution} />
          <Row label="Other Income" value={summary.income.other} />
          <div className="border-t border-slate-200 pt-2 mt-2">
            <Row label="Total Gross Income" value={summary.income.total} bold />
          </div>
          <Row label="VAT on Income" value={summary.income.vatOnIncome} secondary />
          <Row label="Net Income (after VAT)" value={summary.income.netIncome} secondary bold />
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Expenses</h4>
        <div className="space-y-2 text-sm">
          <Row label="Program Operations" value={summary.expenses.programOperations} />
          <Row label="Technology" value={summary.expenses.technology} />
          <Row label="Business Admin" value={summary.expenses.businessAdmin} />
          <div className="border-t border-slate-200 pt-2 mt-2">
            <Row label="Total Gross Expenses" value={summary.expenses.total} bold />
          </div>
          <Row label="VAT on Expenses (Reclaimable)" value={summary.expenses.vatOnExpenses} secondary />
          <Row label="Net Expenses (after VAT recovery)" value={summary.expenses.netExpenses} secondary bold />
        </div>
      </div>
      <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
        <Row label="NET RESULT (Profit/Loss)" value={summary.result.netResult} bold highlight />
      </div>
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <h4 className="font-semibold text-slate-900 mb-3 text-sm">VAT Summary</h4>
        <div className="space-y-2 text-sm">
          <Row label="VAT on Income (Outbound)" value={summary.income.vatOnIncome} />
          <Row label="VAT on Expenses (Reclaimable)" value={summary.expenses.vatOnExpenses} />
          <div className="border-t border-slate-300 pt-2 mt-2">
            <Row label="NET VAT PAYABLE/(REFUNDABLE)" value={summary.result.netVatPayable} bold />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, secondary, highlight }: {
  label: string; value: number; bold?: boolean; secondary?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-slate-900' : secondary ? 'text-slate-600' : 'text-slate-700'} ${highlight ? 'text-blue-900' : ''}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    'Personal Contribution': 'bg-teal-100 text-teal-800',
    Events: 'bg-purple-100 text-purple-800',
    Programs: 'bg-blue-100 text-blue-800',
    'Program Operations': 'bg-green-100 text-green-800',
    Technology: 'bg-orange-100 text-orange-800',
    'Business Admin': 'bg-slate-100 text-slate-800',
    Other: 'bg-gray-100 text-gray-800',
  };
  return colors[category ?? 'Other'] ?? 'bg-gray-100 text-gray-800';
}
