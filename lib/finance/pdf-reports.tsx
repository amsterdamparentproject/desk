// lib/finance/pdf-reports.tsx
// Browser-only — import dynamically to avoid SSR issues

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { pdf } from '@react-pdf/renderer'
import { ParsedTransaction, FinancialSummary } from './types'

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
  ink:     '#0f172a',
  mid:     '#64748b',
  faint:   '#f1f5f9',
  stripe:  '#f8fafc',
  white:   '#ffffff',
  income:  '#166534',
  expense: '#991b1b',
  amber:   '#713f12',
  amberBg: '#fef9c3',
  amberBorder: '#eab308',
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.ink,
    paddingTop: 44,
    paddingBottom: 60,
    paddingHorizontal: 44,
  },
  // Header
  headerBar: { marginBottom: 20, paddingBottom: 12, borderBottom: `2pt solid ${C.ink}` },
  orgName:   { fontSize: 8, color: C.mid, marginBottom: 6 },
  title:     { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  titleDate: { fontSize: 8, color: C.mid, marginTop: 4 },
  // Section heading
  sectionHead: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.mid,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: `1pt solid ${C.faint}`,
    paddingBottom: 4,
    marginTop: 18,
    marginBottom: 8,
  },
  // Summary rows
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3,   paddingHorizontal: 2 },
  rowBold:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5, paddingHorizontal: 2, backgroundColor: C.stripe },
  rowTotal:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,   paddingHorizontal: 8, backgroundColor: C.ink, marginTop: 4 },
  label:      { color: '#475569' },
  labelBold:  { fontFamily: 'Helvetica-Bold', color: C.ink },
  labelTotal: { fontFamily: 'Helvetica-Bold', color: C.white, fontSize: 10 },
  value:      { color: '#475569' },
  valueBold:  { fontFamily: 'Helvetica-Bold', color: C.ink },
  valueTotal: { fontFamily: 'Helvetica-Bold', color: C.white, fontSize: 10 },
  // Table
  tableHead:    { flexDirection: 'row', backgroundColor: C.ink, paddingVertical: 5, paddingHorizontal: 4, marginTop: 10 },
  tableRow:     { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottom: `0.5pt solid ${C.faint}` },
  tableRowAlt:  { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, backgroundColor: C.stripe, borderBottom: `0.5pt solid ${C.faint}` },
  th:      { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.white },
  td:      { fontSize: 7.5, color: '#374151' },
  tdMuted: { fontSize: 7.5, color: C.mid },
  // Note box
  noteBox:  { backgroundColor: C.amberBg, borderLeft: `3pt solid ${C.amberBorder}`, padding: 8, marginBottom: 12, marginTop: 4 },
  noteText: { fontSize: 7.5, color: C.amber },
  // Footer
  footer:     { position: 'absolute', bottom: 28, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTop: `0.5pt solid ${C.faint}`, paddingTop: 5 },
  footerText: { fontSize: 7, color: C.mid },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const eur = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

// ─── Sub-components ───────────────────────────────────────────────────────────

function SumRow({ label, value, bold, total }: { label: string; value: number; bold?: boolean; total?: boolean }) {
  if (total) return (
    <View style={s.rowTotal}>
      <Text style={s.labelTotal}>{label}</Text>
      <Text style={s.valueTotal}>{eur(value)}</Text>
    </View>
  )
  if (bold) return (
    <View style={s.rowBold}>
      <Text style={s.labelBold}>{label}</Text>
      <Text style={s.valueBold}>{eur(value)}</Text>
    </View>
  )
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{eur(value)}</Text>
    </View>
  )
}

function SectionHead({ children }: { children: string }) {
  return <Text style={s.sectionHead}>{children}</Text>
}

function Footer({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{label} — Vertrouwelijk / Confidential</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function TxTable({ transactions, showVat, lang }: {
  transactions: ParsedTransaction[]
  showVat: boolean
  lang: 'nl' | 'en'
}) {
  const W = { date: '12%', desc: showVat ? '34%' : '40%', cat: '18%', type: '12%', amt: '16%', vat: '8%' }
  const H = lang === 'nl'
    ? { date: 'Datum', desc: 'Omschrijving', cat: 'Categorie', type: 'Af/Bij', amt: 'Bedrag', vat: 'BTW' }
    : { date: 'Date',  desc: 'Description',  cat: 'Category',  type: 'Type',   amt: 'Amount (EUR)', vat: '' }

  return (
    <>
      <View style={s.tableHead}>
        <View style={{ width: W.date }}><Text style={s.th}>{H.date}</Text></View>
        <View style={{ width: W.desc }}><Text style={s.th}>{H.desc}</Text></View>
        <View style={{ width: W.cat  }}><Text style={s.th}>{H.cat}</Text></View>
        <View style={{ width: W.type }}><Text style={s.th}>{H.type}</Text></View>
        <View style={{ width: W.amt, alignItems: 'flex-end' }}><Text style={s.th}>{H.amt}</Text></View>
        {showVat && <View style={{ width: W.vat, alignItems: 'flex-end' }}><Text style={s.th}>{H.vat}</Text></View>}
      </View>

      {transactions.map((tx, i) => (
        <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
          <View style={{ width: W.date }}><Text style={s.tdMuted}>{tx.date}</Text></View>
          <View style={{ width: W.desc }}><Text style={s.td}>{tx.description.slice(0, 46)}</Text></View>
          <View style={{ width: W.cat  }}><Text style={s.tdMuted}>{tx.category ?? 'Other'}</Text></View>
          <View style={{ width: W.type }}>
            <Text style={[s.td, { color: tx.isIncome ? C.income : C.expense }]}>
              {lang === 'nl' ? (tx.isIncome ? 'Bij' : 'Af') : (tx.isIncome ? 'Income' : 'Expense')}
            </Text>
          </View>
          <View style={{ width: W.amt, alignItems: 'flex-end' }}>
            <Text style={[s.td, { fontFamily: 'Helvetica-Bold' }]}>
              {tx.isIncome ? '' : '−'}{eur(tx.amount)}
            </Text>
          </View>
          {showVat && (
            <View style={{ width: W.vat, alignItems: 'flex-end' }}>
              <Text style={s.tdMuted}>{eur(tx.vatAmount)}</Text>
            </View>
          )}
        </View>
      ))}
    </>
  )
}

// ─── Document components ──────────────────────────────────────────────────────

export function NLReportDocument({ transactions, summary }: { transactions: ParsedTransaction[]; summary: FinancialSummary }) {
  const date = new Date().toLocaleDateString('nl-NL')
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <Text style={s.orgName}>Amsterdam Parent Project</Text>
          <Text style={s.title}>Winst- en Verliesrekening + BTW</Text>
          <Text style={s.titleDate}>Gegenereerd op {date}</Text>
        </View>

        <SectionHead>Omzet</SectionHead>
        <SumRow label="Events (Eventbrite / Luma)"     value={summary.income.events} />
        <SumRow label="Programs (Stripe / Direct)"     value={summary.income.programs} />
        <SumRow label="Persoonlijke Bijdragen"         value={summary.income.personalContribution} />
        <SumRow label="Overig"                         value={summary.income.other} />
        <SumRow label="Totale Bruto Omzet"             value={summary.income.total}      bold />
        <SumRow label="BTW op Omzet (21%)"             value={summary.income.vatOnIncome} />
        <SumRow label="Netto Omzet (excl. BTW)"        value={summary.income.netIncome}  bold />

        <SectionHead>Kosten</SectionHead>
        <SumRow label="Programma Operaties"                   value={summary.expenses.programOperations} />
        <SumRow label="Technologie"                           value={summary.expenses.technology} />
        <SumRow label="Bedrijfsadministratie"                 value={summary.expenses.businessAdmin} />
        <SumRow label="Totale Bruto Kosten"                   value={summary.expenses.total}          bold />
        <SumRow label="BTW op Kosten (terug te vorderen)"     value={summary.expenses.vatOnExpenses} />
        <SumRow label="Netto Kosten (excl. BTW)"              value={summary.expenses.netExpenses}    bold />

        <SumRow label="Nettoresultaat (Winst / Verlies)" value={summary.result.netResult} total />

        <SectionHead>BTW-Aangifte</SectionHead>
        <SumRow label="BTW op Omzet (af te dragen)"                      value={summary.income.vatOnIncome} />
        <SumRow label="BTW op Kosten (terug te vorderen)"                 value={summary.expenses.vatOnExpenses} />
        <SumRow label="Netto BTW Te Betalen / (Terug te ontvangen)"       value={summary.result.netVatPayable} bold />

        <SectionHead>{`Transacties (${transactions.length})`}</SectionHead>
        <TxTable transactions={transactions} showVat lang="nl" />

        <Footer label="Amsterdam Parent Project" />
      </Page>
    </Document>
  )
}

export function USReportDocument({ transactions, summary }: { transactions: ParsedTransaction[]; summary: FinancialSummary }) {
  const date = new Date().toLocaleDateString('en-US')
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.headerBar}>
          <Text style={s.orgName}>Amsterdam Parent Project</Text>
          <Text style={s.title}>US Tax Report</Text>
          <Text style={s.titleDate}>Generated {date}</Text>
        </View>

        <View style={s.noteBox}>
          <Text style={s.noteText}>
            All amounts in EUR. Convert to USD using the IRS yearly average exchange rate
            (irs.gov → International Taxpayers → Yearly Average Currency Exchange Rates).
          </Text>
        </View>

        <SectionHead>Gross Income</SectionHead>
        <SumRow label="Events"              value={summary.income.events} />
        <SumRow label="Programs"            value={summary.income.programs} />
        <SumRow label="Other Income"        value={summary.income.other} />
        <SumRow label="Total Gross Income"  value={summary.income.total} bold />

        <SectionHead>Deductible Business Expenses</SectionHead>
        <SumRow label="Program Operations"               value={summary.expenses.programOperations} />
        <SumRow label="Technology (Software & Services)" value={summary.expenses.technology} />
        <SumRow label="Business Administration"          value={summary.expenses.businessAdmin} />
        <SumRow label="Total Expenses"                   value={summary.expenses.total} bold />

        <SumRow label="Net Profit / (Loss)" value={summary.result.netResult} total />

        <View style={[s.noteBox, { marginTop: 12 }]}>
          <Text style={s.noteText}>
            Dutch BTW (VAT) is not separately deductible for US tax purposes — report gross figures above.
            Consult your tax advisor regarding FBAR, Form 8938, and Schedule C requirements for foreign income.
          </Text>
        </View>

        <SectionHead>{`Transactions (${transactions.length})`}</SectionHead>
        <TxTable transactions={transactions} showVat={false} lang="en" />

        <Footer label="Amsterdam Parent Project" />
      </Page>
    </Document>
  )
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const slug = () => new Date().toISOString().slice(0, 10)

export async function downloadNLPDF(transactions: ParsedTransaction[], summary: FinancialSummary): Promise<void> {
  const blob = await pdf(<NLReportDocument transactions={transactions} summary={summary} />).toBlob()
  triggerBlobDownload(blob, `amsterdam-parent-nl-rapport-${slug()}.pdf`)
}

export async function downloadUSPDF(transactions: ParsedTransaction[], summary: FinancialSummary): Promise<void> {
  const blob = await pdf(<USReportDocument transactions={transactions} summary={summary} />).toBlob()
  triggerBlobDownload(blob, `amsterdam-parent-us-tax-${slug()}.pdf`)
}
