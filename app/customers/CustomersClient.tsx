'use client'

import { useMemo, useState } from 'react'
import type { CustomerRow } from '@/lib/stripe/types'


function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent = 'bg-slate-50 border-slate-200',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}


// ── CustomersClient ───────────────────────────────────────────────────────────
export function CustomersClient({ initialRows }: { initialRows: CustomerRow[] }) {
  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('all')
  const [activeOnly, setActiveOnly] = useState(false)
  const [groupByCustomer, setGroupByCustomer] = useState(false)
  const [testFilter, setTestFilter] = useState<'live' | 'test' | 'all'>('live')

  // Collect unique products
  const products = useMemo(
    () => Array.from(new Set(initialRows.map((r) => r.product))).sort(),
    [initialRows],
  )

  // Collect unique custom-field labels for dynamic filter UI
  const customFieldLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const row of initialRows) {
      for (const cf of row.customFields) {
        labels.add(cf.label)
      }
    }
    return Array.from(labels)
  }, [initialRows])

  const [cfFilters, setCfFilters] = useState<Record<string, string>>({})

  // Collect unique values per custom-field label
  const cfOptions = useMemo(() => {
    const opts: Record<string, string[]> = {}
    for (const label of customFieldLabels) {
      const vals = new Set<string>()
      for (const row of initialRows) {
        const field = row.customFields.find((f) => f.label === label)
        if (field?.value) vals.add(field.value)
      }
      opts[label] = Array.from(vals).sort()
    }
    return opts
  }, [initialRows, customFieldLabels])

  // Filtered rows
  const filtered = useMemo(() => {
    let rows = initialRows

    if (testFilter === 'live') rows = rows.filter((r) => !r.isTest)
    else if (testFilter === 'test') rows = rows.filter((r) => r.isTest)

    if (productFilter !== 'all') rows = rows.filter((r) => r.product === productFilter)
    if (activeOnly) rows = rows.filter((r) => r.isActive)

    for (const [label, val] of Object.entries(cfFilters)) {
      if (!val || val === 'all') continue
      rows = rows.filter((r) => r.customFields.find((f) => f.label === label && f.value === val))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
      )
    }

    if (groupByCustomer) {
      const seen = new Set<string>()
      rows = rows.filter((r) => {
        if (seen.has(r.email)) return false
        seen.add(r.email)
        return true
      })
    }

    return rows
  }, [initialRows, testFilter, productFilter, activeOnly, cfFilters, search, groupByCustomer])

  // Stats over filtered rows
  const stats = useMemo(() => {
    const total = filtered.length
    const byProduct: Record<string, number> = {}
    for (const row of filtered) {
      byProduct[row.product] = (byProduct[row.product] ?? 0) + 1
    }

    const isNewbornSupport = (p: string) =>
      p.toLowerCase().includes('fourth trimester') || p.toLowerCase().includes('deposit')

    const unlabelled: [string, number][] = []
    const newbornSupport: [string, number][] = []

    for (const [product, count] of Object.entries(byProduct)) {
      if (isNewbornSupport(product)) newbornSupport.push([product, count])
      else unlabelled.push([product, count])
    }

    return { total, unlabelled, newbornSupport }
  }, [filtered])

  // CSV export
  const handleExport = () => {
    const headers = ['Name', 'Email', 'Product', 'Mode', 'Status', 'Active', 'Amount', 'Currency', 'Date', ...customFieldLabels, 'Dashboard']
    const csvRows = filtered.map((r) => {
      const cfValues = customFieldLabels.map(
        (label) => r.customFields.find((f) => f.label === label)?.value ?? '',
      )
      return [
        r.name,
        r.email,
        r.product,
        r.mode,
        r.status,
        r.isActive ? 'Yes' : 'No',
        r.amount.toString(),
        r.currency.toUpperCase(),
        formatDate(r.created),
        ...cfValues,
        r.dashboardUrl,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Roster</h1>
            <p className="text-sm text-slate-500 mt-0.5">Live from Stripe · {stats.total} total enrollments</p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="space-y-3">
          {/* Unlabelled section */}
          {stats.unlabelled.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.unlabelled.map(([product, count]) => (
                <StatCard key={product} label={product} value={count} accent="bg-slate-50 border-slate-200" />
              ))}
            </div>
          )}

          {/* Newborn support section */}
          {stats.newbornSupport.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1">Newborn support</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.newbornSupport.map(([product, count]) => (
                  <StatCard key={product} label={product} value={count} accent="bg-blue-50 border-blue-200" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 w-56 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />

          {/* Product */}
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          >
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Dynamic custom-field filters */}
          {customFieldLabels.map((label) => (
            <select
              key={label}
              value={cfFilters[label] ?? 'all'}
              onChange={(e) =>
                setCfFilters((prev) => ({ ...prev, [label]: e.target.value }))
              }
              className="border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="all">All {label}</option>
              {cfOptions[label]?.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ))}

          {/* Live / test toggle */}
          <select
            value={testFilter}
            onChange={(e) => setTestFilter(e.target.value as 'live' | 'test' | 'all')}
            className="border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          >
            <option value="live">Live only</option>
            <option value="all">Live + Test</option>
            <option value="test">Test only</option>
          </select>

          {/* Active only */}
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded accent-blue-600"
            />
            Active only
          </label>

          {/* Group by customer */}
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={groupByCustomer}
              onChange={(e) => setGroupByCustomer(e.target.checked)}
              className="rounded accent-blue-600"
            />
            Unique customers
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                  {customFieldLabels.map((label) => (
                    <th key={label} className="text-left py-3 px-4 font-medium text-slate-600">
                      {label}
                    </th>
                  ))}
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6 + customFieldLabels.length} className="py-12 text-center text-slate-400">
                      No customers match the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.sessionId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {row.name || <span className="text-slate-400 italic">—</span>}
                      {row.isTest && (
                        <span className="ml-1.5 text-xs font-mono bg-yellow-100 text-yellow-700 px-1 rounded">TEST</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.email}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">
                      <span className="text-xs">{row.product}</span>
                    </td>
                    {customFieldLabels.map((label) => (
                      <td key={label} className="py-3 px-4 text-slate-600">
                        {row.customFields.find((f) => f.label === label)?.value ?? '—'}
                      </td>
                    ))}
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          row.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.isActive ? 'Active' : row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(row.created)}
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={row.dashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Stripe ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
