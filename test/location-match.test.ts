import { describe, it, expect } from 'vitest'
import { Location } from '../app/types/activity'

// This mirrors the matchedLoc logic in ActivityDrawer:
//   locations.find(l => l.name.toLowerCase() === (org ?? '').toLowerCase())
function findMatchedLocation(locations: Pick<Location, 'id' | 'name'>[], org: string | null | undefined) {
  return locations.find(l => l.name.toLowerCase() === (org ?? '').toLowerCase()) ?? null
}

const LOCATIONS: Pick<Location, 'id' | 'name'>[] = [
  { id: 'loc-1', name: 'Moederhuis' },
  { id: 'loc-2', name: 'Café Brouwer' },
]

describe('ActivityDrawer location matching', () => {
  describe('when activity.organization matches a saved location name', () => {
    it('returns the matching location (exact case)', () => {
      const result = findMatchedLocation(LOCATIONS, 'Moederhuis')
      expect(result).not.toBeNull()
      expect(result?.id).toBe('loc-1')
      expect(result?.name).toBe('Moederhuis')
    })

    it('matches case-insensitively', () => {
      expect(findMatchedLocation(LOCATIONS, 'moederhuis')?.id).toBe('loc-1')
      expect(findMatchedLocation(LOCATIONS, 'MOEDERHUIS')?.id).toBe('loc-1')
      expect(findMatchedLocation(LOCATIONS, 'café brouwer')?.id).toBe('loc-2')
    })
  })

  describe('when activity.organization does not match any saved location', () => {
    it('returns null for an unknown org', () => {
      expect(findMatchedLocation(LOCATIONS, 'Unknown Venue')).toBeNull()
    })

    it('returns null when organization is null', () => {
      expect(findMatchedLocation(LOCATIONS, null)).toBeNull()
    })

    it('returns null when organization is empty string', () => {
      expect(findMatchedLocation(LOCATIONS, '')).toBeNull()
    })
  })
})
