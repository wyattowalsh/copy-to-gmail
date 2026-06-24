import {
  defaultThemeId,
  parseThemeJson,
  type ThemeDefinition,
  type ThemePreference,
} from './themes'

export type EditorMode = 'visual' | 'source'
export type DefaultPreviewMode = 'rendered' | 'plain' | 'source'
export type EditorCanvasSize = 'compact' | 'comfortable' | 'wide'
export type InspectorDefault = 'auto' | 'expanded' | 'collapsed'

export type AppSettings = {
  version: 1
  editorMode: EditorMode
  themePreference: ThemePreference
  selectedThemeId: string
  customTheme?: ThemeDefinition
  clipboardPrivacyReminder: boolean
  defaultPreviewMode: DefaultPreviewMode
  draftRecovery: boolean
  editorCanvas: EditorCanvasSize
  focusEditorOnLaunch: boolean
  inspectorDefault: InspectorDefault
  keepGmailControlsVisible: boolean
  showEditorMetrics: boolean
}

export const settingsStorageKey = 'copy-to-gmail.settings.v1'

export const defaultSettings: AppSettings = {
  version: 1,
  editorMode: 'visual',
  themePreference: 'system',
  selectedThemeId: defaultThemeId,
  clipboardPrivacyReminder: true,
  defaultPreviewMode: 'rendered',
  draftRecovery: false,
  editorCanvas: 'comfortable',
  focusEditorOnLaunch: false,
  inspectorDefault: 'auto',
  keepGmailControlsVisible: true,
  showEditorMetrics: true,
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
  const defaultPreviewMode = isDefaultPreviewMode(record.defaultPreviewMode)
    ? record.defaultPreviewMode
    : defaultSettings.defaultPreviewMode
  const editorCanvas = isEditorCanvasSize(record.editorCanvas)
    ? record.editorCanvas
    : defaultSettings.editorCanvas
  const inspectorDefault = isInspectorDefault(record.inspectorDefault)
    ? record.inspectorDefault
    : defaultSettings.inspectorDefault
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
    defaultPreviewMode,
    draftRecovery:
      typeof record.draftRecovery === 'boolean'
        ? record.draftRecovery
        : defaultSettings.draftRecovery,
    editorCanvas,
    focusEditorOnLaunch:
      typeof record.focusEditorOnLaunch === 'boolean'
        ? record.focusEditorOnLaunch
        : defaultSettings.focusEditorOnLaunch,
    inspectorDefault,
    keepGmailControlsVisible:
      typeof record.keepGmailControlsVisible === 'boolean'
        ? record.keepGmailControlsVisible
        : defaultSettings.keepGmailControlsVisible,
    showEditorMetrics:
      typeof record.showEditorMetrics === 'boolean'
        ? record.showEditorMetrics
        : defaultSettings.showEditorMetrics,
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

function isDefaultPreviewMode(value: unknown): value is DefaultPreviewMode {
  return value === 'rendered' || value === 'plain' || value === 'source'
}

function isEditorCanvasSize(value: unknown): value is EditorCanvasSize {
  return value === 'compact' || value === 'comfortable' || value === 'wide'
}

function isInspectorDefault(value: unknown): value is InspectorDefault {
  return value === 'auto' || value === 'expanded' || value === 'collapsed'
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
