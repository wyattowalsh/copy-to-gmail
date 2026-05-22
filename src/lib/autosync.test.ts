import { describe, expect, it } from 'vitest'

import { getAutosyncDelay } from './autosync'

describe('getAutosyncDelay', () => {
  it('debounces linked significant changes', () => {
    expect(
      getAutosyncDelay(
        {
          changed: true,
          lastSyncedAt: new Date(1_000).toISOString(),
          linked: true,
          now: 2_000,
        },
        { debounceMs: 500, maxUnsyncedMs: 10_000 },
      ),
    ).toBe(500)
  })

  it('syncs immediately after the max unsynced window', () => {
    expect(
      getAutosyncDelay(
        {
          changed: true,
          lastSyncedAt: new Date(1_000).toISOString(),
          linked: true,
          now: 20_000,
        },
        { debounceMs: 500, maxUnsyncedMs: 10_000 },
      ),
    ).toBe(0)
  })

  it('does not autosync unresolved conflicts', () => {
    expect(
      getAutosyncDelay({ changed: true, linked: true, status: 'conflict' }),
    ).toBeNull()
  })
})
