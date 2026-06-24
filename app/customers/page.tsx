import { Suspense } from 'react'
import { getCustomerRoster } from '@/app/actions/customers'
import { CustomersClient } from './CustomersClient'

export default async function CustomersPage() {
  const rows = await getCustomerRoster()
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading customers…</div>}>
      <CustomersClient initialRows={rows} />
    </Suspense>
  )
}
