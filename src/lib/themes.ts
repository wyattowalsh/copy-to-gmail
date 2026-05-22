export type ThemeMode = 'light' | 'dark'
export type ThemePreference = 'light' | 'dark' | 'system' | 'custom'
export type ThemeDensity = 'comfortable' | 'compact'

export type ThemeTokens = {
  background: string
  panel: string
  paper: string
  ink: string
  muted: string
  line: string
  lineStrong: string
  accent: string
  accentStrong: string
  success: string
  warning: string
  danger: string
  focus: string
  editorBg: string
  editorGrid: string
  panelMuted: string
  shadow: string
  radius: string
  density: ThemeDensity
}

export type ThemeDefinition = {
  id: string
  version: 1
  name: string
  mode: ThemeMode
  tokens: ThemeTokens
}

export type ThemeParseResult =
  | { ok: true; theme: ThemeDefinition }
  | { ok: false; error: string }

const baseLight: ThemeTokens = {
  background: '#eef5ff',
  panel: '#f8fbff',
  paper: '#ffffff',
  ink: '#061b3a',
  muted: '#526174',
  line: '#cfdded',
  lineStrong: '#9fb4cc',
  accent: '#0b66e4',
  accentStrong: '#063f8f',
  success: '#188038',
  warning: '#f9ab00',
  danger: '#d93025',
  focus: '#00a3ff',
  editorBg: '#e5effb',
  editorGrid: 'rgb(11 102 228 / 5%)',
  panelMuted: '#edf5ff',
  shadow: '0 28px 80px rgb(6 27 58 / 14%)',
  radius: '20px',
  density: 'comfortable',
}

const baseDark: ThemeTokens = {
  background: '#07111f',
  panel: '#0d1a2c',
  paper: '#111f34',
  ink: '#f4f8ff',
  muted: '#a8b8cc',
  line: '#213a58',
  lineStrong: '#3b5c82',
  accent: '#64b5ff',
  accentStrong: '#1f7de0',
  success: '#4cc979',
  warning: '#ffc447',
  danger: '#ff8178',
  focus: '#8bd3ff',
  editorBg: '#09182b',
  editorGrid: 'rgb(100 181 255 / 7%)',
  panelMuted: '#13243a',
  shadow: '0 28px 80px rgb(0 0 0 / 38%)',
  radius: '20px',
  density: 'comfortable',
}

export const THEME_PRESETS: ThemeDefinition[] = [
  preset('normal-light', 'Mail Glass', 'light', baseLight),
  preset('normal-dark', 'Mail Glass Dark', 'dark', baseDark),
  preset('gmail-clean', 'Gmail Clean', 'light', {
    ...baseLight,
    background: '#f8fafc',
    panel: '#ffffff',
    paper: '#ffffff',
    ink: '#202124',
    muted: '#5f6368',
    line: '#dadce0',
    lineStrong: '#bdc1c6',
    accent: '#1a73e8',
    accentStrong: '#1558b0',
    editorBg: '#f1f3f4',
    panelMuted: '#f8fafd',
  }),
  preset('minimal-ink', 'Minimal Ink', 'light', {
    ...baseLight,
    background: '#f3f1ed',
    panel: '#fbfaf7',
    paper: '#fffffc',
    ink: '#151515',
    muted: '#62605a',
    line: '#d9d4ca',
    lineStrong: '#bdb5a7',
    accent: '#111827',
    accentStrong: '#000000',
    editorGrid: 'rgb(0 0 0 / 2%)',
  }),
  preset('warm-paper', 'Warm Paper', 'light', {
    ...baseLight,
    background: '#f4ead7',
    panel: '#fff8ea',
    paper: '#fffdf5',
    ink: '#2d2118',
    muted: '#735f4a',
    line: '#e6d2b7',
    lineStrong: '#c5a77e',
    accent: '#b45309',
    accentStrong: '#92400e',
    editorBg: '#ead8bd',
    panelMuted: '#fff0d7',
  }),
  preset('rose-pine', 'Rosé Pine', 'dark', {
    ...baseDark,
    background: '#191724',
    panel: '#1f1d2e',
    paper: '#26233a',
    ink: '#e0def4',
    muted: '#908caa',
    line: '#403d52',
    lineStrong: '#524f67',
    accent: '#c4a7e7',
    accentStrong: '#ebbcba',
    success: '#9ccfd8',
    warning: '#f6c177',
    danger: '#eb6f92',
    focus: '#c4a7e7',
    editorBg: '#171421',
    editorGrid: 'rgb(196 167 231 / 5%)',
    panelMuted: '#242136',
  }),
  preset('rose-light', 'Rose Light', 'light', {
    ...baseLight,
    background: '#faf4ed',
    panel: '#fffaf3',
    paper: '#fffaf8',
    ink: '#575279',
    muted: '#797593',
    line: '#dfdad9',
    lineStrong: '#cecacd',
    accent: '#d7827e',
    accentStrong: '#b4637a',
    success: '#56949f',
    warning: '#ea9d34',
    danger: '#b4637a',
    focus: '#286983',
    editorBg: '#f2e9e1',
    editorGrid: 'rgb(215 130 126 / 4%)',
    panelMuted: '#f4ede8',
  }),
  preset('rose-dark', 'Rose Dark', 'dark', {
    ...baseDark,
    background: '#232136',
    panel: '#2a273f',
    paper: '#393552',
    ink: '#e0def4',
    muted: '#908caa',
    line: '#44415a',
    lineStrong: '#56526e',
    accent: '#c4a7e7',
    accentStrong: '#ea9a97',
    success: '#9ccfd8',
    warning: '#f6c177',
    danger: '#eb6f92',
    focus: '#c4a7e7',
    editorBg: '#201d31',
    editorGrid: 'rgb(196 167 231 / 5%)',
    panelMuted: '#2d2944',
  }),
  preset('high-contrast-light', 'High Contrast Light', 'light', {
    ...baseLight,
    background: '#ffffff',
    panel: '#ffffff',
    paper: '#ffffff',
    ink: '#000000',
    muted: '#303030',
    line: '#727272',
    lineStrong: '#111111',
    accent: '#003cff',
    accentStrong: '#001f8f',
    success: '#006b2e',
    warning: '#8a3f00',
    danger: '#b00020',
    focus: '#003cff',
    editorBg: '#f2f2f2',
    editorGrid: 'rgb(0 0 0 / 4%)',
  }),
  preset('high-contrast-dark', 'High Contrast Dark', 'dark', {
    ...baseDark,
    background: '#000000',
    panel: '#080808',
    paper: '#101010',
    ink: '#ffffff',
    muted: '#e2e2e2',
    line: '#a8a8a8',
    lineStrong: '#ffffff',
    accent: '#9db7ff',
    accentStrong: '#ffffff',
    success: '#72ff9a',
    warning: '#ffd166',
    danger: '#ff8fa3',
    focus: '#ffffff',
    editorBg: '#000000',
    editorGrid: 'rgb(255 255 255 / 7%)',
  }),
]

export const defaultThemeId = 'normal-light'
export const defaultDarkThemeId = 'normal-dark'

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_PRESETS.find((theme) => theme.id === id)
}

export function resolveTheme(
  preference: ThemePreference,
  selectedThemeId: string,
  customTheme: ThemeDefinition | undefined,
  prefersDark: boolean,
): ThemeDefinition {
  if (preference === 'custom' && customTheme) {
    return customTheme
  }

  if (preference === 'dark') {
    return getThemeById(selectedThemeId)?.mode === 'dark'
      ? getThemeById(selectedThemeId)!
      : getThemeById(defaultDarkThemeId)!
  }

  if (preference === 'light') {
    return getThemeById(selectedThemeId)?.mode === 'light'
      ? getThemeById(selectedThemeId)!
      : getThemeById(defaultThemeId)!
  }

  return getThemeById(prefersDark ? defaultDarkThemeId : defaultThemeId)!
}

export function createThemeStyle(
  theme: ThemeDefinition,
): Record<string, string> {
  return {
    '--bg': theme.tokens.background,
    '--panel': theme.tokens.panel,
    '--paper': theme.tokens.paper,
    '--ink': theme.tokens.ink,
    '--muted': theme.tokens.muted,
    '--line': theme.tokens.line,
    '--line-strong': theme.tokens.lineStrong,
    '--blue': theme.tokens.accent,
    '--blue-dark': theme.tokens.accentStrong,
    '--green': theme.tokens.success,
    '--amber': theme.tokens.warning,
    '--red': theme.tokens.danger,
    '--focus': theme.tokens.focus,
    '--editor-bg': theme.tokens.editorBg,
    '--editor-grid': theme.tokens.editorGrid,
    '--panel-muted': theme.tokens.panelMuted,
    '--shadow': theme.tokens.shadow,
    '--radius': theme.tokens.radius,
  }
}

export function serializeTheme(theme: ThemeDefinition): string {
  return JSON.stringify(theme, null, 2)
}

export function parseThemeJson(value: string): ThemeParseResult {
  try {
    const parsed = JSON.parse(value) as unknown

    if (!isRecord(parsed)) {
      return { ok: false, error: 'Theme JSON must be an object.' }
    }

    const version = parsed.version
    const id = parsed.id
    const name = parsed.name
    const mode = parsed.mode
    const tokens = parsed.tokens

    if (version !== 1) {
      return { ok: false, error: 'Theme version must be 1.' }
    }

    if (typeof name !== 'string' || !name.trim()) {
      return { ok: false, error: 'Theme name is required.' }
    }

    if (mode !== 'light' && mode !== 'dark') {
      return { ok: false, error: 'Theme mode must be light or dark.' }
    }

    if (!isRecord(tokens)) {
      return { ok: false, error: 'Theme tokens are required.' }
    }

    const themeTokens = normalizeTokens(tokens)

    if (!themeTokens) {
      return {
        ok: false,
        error:
          'Theme tokens must contain safe colors, radius, shadow, and density values.',
      }
    }

    return {
      ok: true,
      theme: {
        id: normalizeThemeId(id, name),
        version: 1,
        name: name.trim(),
        mode,
        tokens: themeTokens,
      },
    }
  } catch {
    return { ok: false, error: 'Theme JSON is invalid.' }
  }
}

function preset(
  id: string,
  name: string,
  mode: ThemeMode,
  tokens: ThemeTokens,
): ThemeDefinition {
  return { id, version: 1, name, mode, tokens }
}

function normalizeTokens(value: Record<string, unknown>): ThemeTokens | null {
  const tokens = { ...baseLight, ...value }

  if (!isThemeDensity(tokens.density) || !isSafeLength(tokens.radius)) {
    return null
  }

  for (const key of colorKeys) {
    if (typeof tokens[key] !== 'string' || !isSafeColor(tokens[key])) {
      return null
    }
  }

  if (typeof tokens.shadow !== 'string' || !isSafeShadow(tokens.shadow)) {
    return null
  }

  return tokens
}

const colorKeys = [
  'background',
  'panel',
  'paper',
  'ink',
  'muted',
  'line',
  'lineStrong',
  'accent',
  'accentStrong',
  'success',
  'warning',
  'danger',
  'focus',
  'editorBg',
  'editorGrid',
  'panelMuted',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeColor(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgb\([^;{}]+\)|rgba\([^;{}]+\)|hsl\([^;{}]+\)|hsla\([^;{}]+\)|[a-z]+)$/i.test(
    value,
  )
}

function isSafeShadow(value: string): boolean {
  return !/[;{}<>]|url\s*\(|expression\s*\(|javascript\s*:/i.test(value)
}

function isSafeLength(value: string): boolean {
  return /^\d+(\.\d+)?(px|rem|em)$/.test(value)
}

function isThemeDensity(value: unknown): value is ThemeDensity {
  return value === 'comfortable' || value === 'compact'
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function normalizeThemeId(value: unknown, name: string): string {
  if (typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    return value
  }

  return `custom-${slugify(name)}`
}
