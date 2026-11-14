import { describe, it, expect } from 'vitest'
import { rollIssueDate, DEFAULT_ISSUE_DATE } from '../lib/issue-date'

describe('rollIssueDate', () => {
  it('keeps a date that is today or later', () => {
    expect(rollIssueDate('2026-11-16', '2026-11-14')).toBe('2026-11-16')
    expect(rollIssueDate('2026-11-16', '2026-11-16')).toBe('2026-11-16')
  })
  it('advances by 14 days once the date has passed', () => {
    expect(rollIssueDate('2026-11-16', '2026-11-17')).toBe('2026-11-30')
    expect(rollIssueDate('2026-11-16', '2026-12-15')).toBe('2026-12-14')
  })
  it('falls back to the anchor when nothing valid is stored', () => {
    expect(rollIssueDate(null, '2026-11-14')).toBe(DEFAULT_ISSUE_DATE)
    expect(rollIssueDate('garbage', '2026-11-14')).toBe(DEFAULT_ISSUE_DATE)
  })
})
