export type Tab = 'triage' | 'newsletter' | 'post' | 'locations' | 'done'

// Stage only (where a row is in the process); health lives in `status`.
//   inbox   - captured, still in Desk triage
//   refined - marked "Done refining"; shown in the Newsletter / Post tabs by service
//   done    - out of the pipeline: archived, rejected, or published with no services left
// See __claude__/list-refactor-plan.md.
export type ListId = 'inbox' | 'refined' | 'done'

export interface ListProps {
  id: ListId
  label: string
  finishLabel?: string
  finishTarget?: (type: 'event' | 'resource') => ListId
}

export const TRIAGE_LISTS: ListProps[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    finishLabel: 'Done refining',
    finishTarget: () => 'refined',
  },
]

// Which of the Newsletter / Post tabs a refined row appears in is decided by
// its services, and whether it is in the next issue by `in_next_issue`.
export const NEWSLETTER_LISTS: ListProps[] = [
  { id: 'refined', label: 'Refined' },
]

// 'done' is the unified resting place for anything that has exited the active
// pipeline: archived, rejected, or published with no services left.
// It only ever appears in the Published/Included/Archived tabs.
export const GONE_LISTS: ListProps[] = [{ id: 'done', label: 'Done' }]

export const ALL_LISTS: ListProps[] = [
  ...TRIAGE_LISTS,
  ...NEWSLETTER_LISTS,
  ...GONE_LISTS,
]

export function getListTab(listId: ListId): Tab {
  if (listId === 'inbox') return 'triage'
  if (listId === 'refined') return 'newsletter'
  // 'done' belongs in the Done tab, never Triage.
  return 'done'
}
