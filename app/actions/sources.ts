'use server'

import { createAdminClient } from '@/app/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FetchType = 'ical' | 'api' | 'scrape' | 'rss'

export interface Source {
  id: string
  name: string
  url: string
  fetch_type: FetchType
  config: Record<string, unknown> | null
  active: boolean
  last_fetched_at: string | null
  notes: string | null
  created_at: string
}

export async function getSources(): Promise<Source[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createSource(input: {
  name: string
  url: string
  fetch_type: FetchType
  config?: Record<string, unknown> | null
  notes?: string | null
}): Promise<Source> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sources')
    .insert({ ...input, active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/sources')
  return data
}

export async function updateSource(
  id: string,
  input: Partial<Omit<Source, 'id' | 'created_at'>>
): Promise<Source> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sources')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/sources')
  return data
}

export async function deleteSource(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sources').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sources')
}
