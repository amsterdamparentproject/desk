// lib/stripe/types.ts

export interface CustomField {
  label: string
  value: string
}

export interface CustomerRow {
  sessionId: string
  customerId: string | null
  name: string
  email: string
  product: string
  mode: 'payment' | 'subscription'
  status: string
  isActive: boolean
  amount: number
  currency: string
  created: number // unix timestamp
  customFields: CustomField[]
  dashboardUrl: string
  isTest: boolean
}
