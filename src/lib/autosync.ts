export type AutosyncInput = {
  changed: boolean
  linked: boolean
  lastSyncedAt?: string
  status?: string
  now?: number
}

export type AutosyncConfig = {
  debounceMs: number
  maxUnsyncedMs: number
}

export const defaultAutosyncConfig: AutosyncConfig = {
  debounceMs: 1_600,
  maxUnsyncedMs: 45_000,
}

export function getAutosyncDelay(
  input: AutosyncInput,
  config: AutosyncConfig = defaultAutosyncConfig,
): number | null {
  if (!input.linked || !input.changed) {
    return null
  }

  if (input.status === 'conflict' || input.status === 'paused') {
    return null
  }

  const lastSyncedAt = Date.parse(input.lastSyncedAt ?? '')
  const now = input.now ?? Date.now()

  if (Number.isFinite(lastSyncedAt)) {
    const elapsed = Math.max(0, now - lastSyncedAt)

    if (elapsed >= config.maxUnsyncedMs) {
      return 0
    }
  }

  return config.debounceMs
}
