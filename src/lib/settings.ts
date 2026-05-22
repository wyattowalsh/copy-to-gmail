import {
  defaultThemeId,
  parseThemeJson,
  type ThemeDefinition,
  type ThemePreference,
} from './themes'

export type EditorMode = 'visual' | 'source'

export type AppSettings = {
  version: 1
  editorMode: EditorMode
  themePreference: ThemePreference
  selectedThemeId: string
  customTheme?: ThemeDefinition
  clipboardPrivacyReminder: boolean
  draftRecovery: boolean
}

export const settingsStorageKey = 'copy-to-gmail.settings.v1'

export const defaultSettings: AppSettings = {
  version: 1,
  editorMode: 'visual',
  themePreference: 'system',
  selectedThemeId: defaultThemeId,
  clipboardPrivacyReminder: true,
  draftRecovery: false,
}

type SettingsStorage = {
  getItem: (key: string) => string | null
  setItem?: (key: string, value: string) => void
}

export function loadSettings(storage = getBrowserStorage()): AppSettings {
  if (!hasStorageReader(storage)) {
    return defaultSettings
  }

  try {
    const raw = storage.getItem(settingsStorageKey)

    if (!raw) {
      return defaultSettings
    }

    return normalizeSettings(JSON.parse(raw) as unknown)
  } catch {
    return defaultSettings
  }
}

export function saveSettings(
  settings: AppSettings,
  storage = getBrowserStorage(),
): void {
  if (!hasStorageWriter(storage)) {
    return
  }

  try {
    storage.setItem(settingsStorageKey, JSON.stringify(settings))
  } catch {
    // Settings are optional; private/locked-down browser storage should not break composing.
  }
}

export function normalizeSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return defaultSettings
  }

  const record = value as Record<string, unknown>
  const editorMode = record.editorMode === 'source' ? 'source' : 'visual'
  const themePreference = isThemePreference(record.themePreference)
    ? record.themePreference
    : defaultSettings.themePreference
  const selectedThemeId =
    typeof record.selectedThemeId === 'string'
      ? record.selectedThemeId
      : defaultSettings.selectedThemeId

  return {
    ...defaultSettings,
    editorMode,
    themePreference,
    selectedThemeId,
    customTheme: normalizeCustomTheme(record.customTheme),
    clipboardPrivacyReminder:
      typeof record.clipboardPrivacyReminder === 'boolean'
        ? record.clipboardPrivacyReminder
        : defaultSettings.clipboardPrivacyReminder,
    draftRecovery:
      typeof record.draftRecovery === 'boolean'
        ? record.draftRecovery
        : defaultSettings.draftRecovery,
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === 'light' ||
    value === 'dark' ||
    value === 'system' ||
    value === 'custom'
  )
}

function normalizeCustomTheme(value: unknown): ThemeDefinition | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  try {
    const result = parseThemeJson(JSON.stringify(value))
    const id = (value as { id?: unknown }).id

    return result.ok
      ? {
          ...result.theme,
          id: typeof id === 'string' && id.trim() ? id : result.theme.id,
        }
      : undefined
  } catch {
    return undefined
  }
}

function getBrowserStorage(): SettingsStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function hasStorageReader(
  storage: SettingsStorage | undefined,
): storage is SettingsStorage {
  return typeof storage?.getItem === 'function'
}

function hasStorageWriter(
  storage: SettingsStorage | undefined,
): storage is Required<SettingsStorage> {
  return (
    typeof storage?.getItem === 'function' &&
    typeof storage.setItem === 'function'
  )
}
