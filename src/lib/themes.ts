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

export type ThemePresetCategory =
  | 'Core'
  | 'Gmail'
  | 'Paper'
  | 'Focus'
  | 'Editorial'
  | 'Rosé Pine'
  | 'Contrast'

export type ThemePresetIndexEntry = {
  id: string
  category: ThemePresetCategory
  keywords: string[]
}

export const THEME_PRESET_CATEGORIES: readonly ThemePresetCategory[] = [
  'Core',
  'Gmail',
  'Paper',
  'Focus',
  'Editorial',
  'Rosé Pine',
  'Contrast',
]

export type ThemeParseResult =
  | { ok: true; theme: ThemeDefinition }
  | { ok: false; error: string }

const baseLight: ThemeTokens = {
  background: '#f6f7f9',
  panel: '#fbfcfe',
  paper: '#ffffff',
  ink: '#18202a',
  muted: '#5b6472',
  line: '#d8dee8',
  lineStrong: '#aeb8c7',
  accent: '#1f6feb',
  accentStrong: '#1957bf',
  success: '#167a3a',
  warning: '#9f6b00',
  danger: '#c9362c',
  focus: '#1f6feb',
  editorBg: '#eef2f6',
  editorGrid: 'rgb(31 111 235 / 4%)',
  panelMuted: '#eef2f6',
  shadow: '0 18px 48px rgb(22 34 51 / 8%)',
  radius: '12px',
  density: 'comfortable',
}

const baseDark: ThemeTokens = {
  background: '#111827',
  panel: '#172033',
  paper: '#1f2937',
  ink: '#f7f9fc',
  muted: '#a8b2c1',
  line: '#303b4f',
  lineStrong: '#526077',
  accent: '#74a7ff',
  accentStrong: '#4f86e8',
  success: '#65c987',
  warning: '#f2c466',
  danger: '#f07872',
  focus: '#9cc2ff',
  editorBg: '#151e2e',
  editorGrid: 'rgb(156 194 255 / 5%)',
  panelMuted: '#202b3d',
  shadow: '0 18px 52px rgb(0 0 0 / 30%)',
  radius: '12px',
  density: 'comfortable',
}

const rosePineMain = {
  base: '#191724',
  surface: '#1f1d2e',
  overlay: '#26233a',
  muted: '#6e6a86',
  subtle: '#908caa',
  text: '#e0def4',
  love: '#eb6f92',
  gold: '#f6c177',
  rose: '#ebbcba',
  pine: '#31748f',
  foam: '#9ccfd8',
  iris: '#c4a7e7',
  highlightLow: '#21202e',
  highlightMed: '#403d52',
  highlightHigh: '#524f67',
} as const

const rosePineMoon = {
  base: '#232136',
  surface: '#2a273f',
  overlay: '#393552',
  muted: '#6e6a86',
  subtle: '#908caa',
  text: '#e0def4',
  love: '#eb6f92',
  gold: '#f6c177',
  rose: '#ea9a97',
  pine: '#3e8fb0',
  foam: '#9ccfd8',
  iris: '#c4a7e7',
  highlightLow: '#2a283e',
  highlightMed: '#44415a',
  highlightHigh: '#56526e',
} as const

const rosePineDawn = {
  base: '#faf4ed',
  surface: '#fffaf3',
  overlay: '#f2e9e1',
  muted: '#9893a5',
  subtle: '#797593',
  text: '#575279',
  love: '#b4637a',
  gold: '#ea9d34',
  rose: '#d7827e',
  pine: '#286983',
  foam: '#56949f',
  iris: '#907aa9',
  highlightLow: '#f4ede8',
  highlightMed: '#dfdad9',
  highlightHigh: '#cecacd',
} as const

export const THEME_PRESETS: ThemeDefinition[] = [
  preset('normal-light', 'Icon Light', 'light', baseLight),
  preset('normal-dark', 'Icon Dark', 'dark', baseDark),
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
  preset('porcelain-blue', 'Porcelain Blue', 'light', {
    ...baseLight,
    background: '#f3f7fb',
    panel: '#fbfdff',
    paper: '#ffffff',
    ink: '#172033',
    muted: '#5a6779',
    line: '#d5e0eb',
    lineStrong: '#a9b8ca',
    accent: '#2563c9',
    accentStrong: '#174ea6',
    editorBg: '#e9f0f7',
    editorGrid: 'rgb(37 99 201 / 4%)',
    panelMuted: '#eef4fa',
  }),
  preset('sage-office', 'Sage Office', 'light', {
    ...baseLight,
    background: '#f4f7f2',
    panel: '#fbfdf8',
    paper: '#ffffff',
    ink: '#19251e',
    muted: '#5d6c61',
    line: '#d6dfd1',
    lineStrong: '#aab9a3',
    accent: '#2f6f4e',
    accentStrong: '#24563d',
    success: '#247246',
    warning: '#946200',
    danger: '#b13d32',
    focus: '#2f6f4e',
    editorBg: '#eaf1e6',
    editorGrid: 'rgb(47 111 78 / 4%)',
    panelMuted: '#eef4eb',
  }),
  preset('zinc-desk', 'Zinc Desk', 'light', {
    ...baseLight,
    background: '#f5f5f4',
    panel: '#fbfbfa',
    paper: '#ffffff',
    ink: '#1c1917',
    muted: '#68625c',
    line: '#dedbd7',
    lineStrong: '#b8b2aa',
    accent: '#334155',
    accentStrong: '#1f2937',
    editorBg: '#eeeeec',
    editorGrid: 'rgb(51 65 85 / 4%)',
    panelMuted: '#efeeec',
  }),
  preset('cloud-letter', 'Cloud Letter', 'light', {
    ...baseLight,
    background: '#f7f8fb',
    panel: '#ffffff',
    paper: '#ffffff',
    ink: '#1b2430',
    muted: '#617083',
    line: '#dce3ec',
    lineStrong: '#b3c0ce',
    accent: '#0f6b8f',
    accentStrong: '#0b536f',
    editorBg: '#edf3f8',
    editorGrid: 'rgb(15 107 143 / 4%)',
    panelMuted: '#f1f5f8',
  }),
  preset('oat-studio', 'Oat Studio', 'light', {
    ...baseLight,
    background: '#f6f1e8',
    panel: '#fffaf1',
    paper: '#fffefd',
    ink: '#28231d',
    muted: '#70675a',
    line: '#e2d7c8',
    lineStrong: '#bcae9b',
    accent: '#8b5f2a',
    accentStrong: '#6d471d',
    editorBg: '#efe5d5',
    editorGrid: 'rgb(139 95 42 / 4%)',
    panelMuted: '#f8eedf',
  }),
  preset('blueprint-light', 'Blueprint Light', 'light', {
    ...baseLight,
    background: '#f1f5fb',
    panel: '#f9fbff',
    paper: '#ffffff',
    ink: '#12213a',
    muted: '#53627a',
    line: '#d1dced',
    lineStrong: '#9fb0c8',
    accent: '#1d5fbf',
    accentStrong: '#164a96',
    editorBg: '#e7eef8',
    editorGrid: 'rgb(29 95 191 / 5%)',
    panelMuted: '#edf3fb',
  }),
  preset('paper-white', 'Paper White', 'light', {
    ...baseLight,
    background: '#f4f6f8',
    panel: '#ffffff',
    paper: '#ffffff',
    ink: '#111827',
    muted: '#5f6b7a',
    line: '#e0e5eb',
    lineStrong: '#b4bfcc',
    accent: '#185abc',
    accentStrong: '#174ea6',
    editorBg: '#eef1f5',
    editorGrid: 'rgb(24 90 188 / 3%)',
    panelMuted: '#f5f7fa',
    density: 'compact',
  }),
  preset('graphite-paper', 'Graphite Paper', 'light', {
    ...baseLight,
    background: '#f2f3f4',
    panel: '#fbfbfb',
    paper: '#ffffff',
    ink: '#171717',
    muted: '#636363',
    line: '#d8d8d8',
    lineStrong: '#a9a9a9',
    accent: '#2f3a45',
    accentStrong: '#17202a',
    editorBg: '#e9ecef',
    editorGrid: 'rgb(47 58 69 / 4%)',
    panelMuted: '#eeeeee',
    density: 'compact',
  }),
  preset('mist-green', 'Mist Green', 'light', {
    ...baseLight,
    background: '#f3f7f5',
    panel: '#fbfdfc',
    paper: '#ffffff',
    ink: '#17251f',
    muted: '#5d6f66',
    line: '#d7e2dc',
    lineStrong: '#a7baaf',
    accent: '#26735c',
    accentStrong: '#1d5a47',
    success: '#247246',
    focus: '#26735c',
    editorBg: '#e9f1ed',
    editorGrid: 'rgb(38 115 92 / 4%)',
    panelMuted: '#edf4f0',
  }),
  preset('harbor-letter', 'Harbor Letter', 'light', {
    ...baseLight,
    background: '#f1f6f8',
    panel: '#fbfdfe',
    paper: '#ffffff',
    ink: '#16242e',
    muted: '#5c6c75',
    line: '#d2e0e5',
    lineStrong: '#a5bac3',
    accent: '#176b87',
    accentStrong: '#11536a',
    editorBg: '#e7f0f4',
    editorGrid: 'rgb(23 107 135 / 4%)',
    panelMuted: '#edf4f7',
  }),
  preset('newsprint', 'Newsprint', 'light', {
    ...baseLight,
    background: '#f5f4ef',
    panel: '#fbfaf6',
    paper: '#fffefa',
    ink: '#1f211d',
    muted: '#686b62',
    line: '#dedbd0',
    lineStrong: '#b6b0a0',
    accent: '#384256',
    accentStrong: '#222b3b',
    editorBg: '#edebe4',
    editorGrid: 'rgb(56 66 86 / 3%)',
    panelMuted: '#f0eee7',
    density: 'compact',
  }),
  preset('copper-memo', 'Copper Memo', 'light', {
    ...baseLight,
    background: '#f8f3ee',
    panel: '#fffaf6',
    paper: '#ffffff',
    ink: '#2a211c',
    muted: '#74665d',
    line: '#e3d6ca',
    lineStrong: '#bca995',
    accent: '#a04f24',
    accentStrong: '#7c3818',
    warning: '#9b5a00',
    editorBg: '#f0e4da',
    editorGrid: 'rgb(160 79 36 / 4%)',
    panelMuted: '#f5ebe2',
  }),
  preset('orchid-note', 'Orchid Note', 'light', {
    ...baseLight,
    background: '#f7f5fa',
    panel: '#fdfcff',
    paper: '#ffffff',
    ink: '#241c2f',
    muted: '#6b6076',
    line: '#ded6e8',
    lineStrong: '#b8abc8',
    accent: '#6d5aa7',
    accentStrong: '#57448e',
    editorBg: '#eee9f5',
    editorGrid: 'rgb(109 90 167 / 4%)',
    panelMuted: '#f2edf8',
  }),
  preset('rose-pine', 'Rosé Pine', 'dark', {
    ...baseDark,
    background: rosePineMain.base,
    panel: rosePineMain.surface,
    paper: rosePineMain.overlay,
    ink: rosePineMain.text,
    muted: rosePineMain.muted,
    line: rosePineMain.highlightMed,
    lineStrong: rosePineMain.highlightHigh,
    accent: rosePineMain.iris,
    accentStrong: rosePineMain.rose,
    success: rosePineMain.pine,
    warning: rosePineMain.gold,
    danger: rosePineMain.love,
    focus: rosePineMain.iris,
    editorBg: rosePineMain.highlightLow,
    editorGrid: 'rgb(110 106 134 / 10%)',
    panelMuted: rosePineMain.highlightLow,
  }),
  preset('rose-pine-dawn', 'Rosé Pine Dawn', 'light', {
    ...baseLight,
    background: rosePineDawn.base,
    panel: rosePineDawn.surface,
    paper: rosePineDawn.overlay,
    ink: rosePineDawn.text,
    muted: rosePineDawn.muted,
    line: rosePineDawn.highlightMed,
    lineStrong: rosePineDawn.highlightHigh,
    accent: rosePineDawn.iris,
    accentStrong: rosePineDawn.rose,
    success: rosePineDawn.pine,
    warning: rosePineDawn.gold,
    danger: rosePineDawn.love,
    focus: rosePineDawn.pine,
    editorBg: rosePineDawn.highlightLow,
    editorGrid: 'rgb(215 130 126 / 4%)',
    panelMuted: rosePineDawn.highlightLow,
  }),
  preset('rose-pine-moon', 'Rosé Pine Moon', 'dark', {
    ...baseDark,
    background: rosePineMoon.base,
    panel: rosePineMoon.surface,
    paper: rosePineMoon.overlay,
    ink: rosePineMoon.text,
    muted: rosePineMoon.muted,
    line: rosePineMoon.highlightMed,
    lineStrong: rosePineMoon.highlightHigh,
    accent: rosePineMoon.iris,
    accentStrong: rosePineMoon.rose,
    success: rosePineMoon.pine,
    warning: rosePineMoon.gold,
    danger: rosePineMoon.love,
    focus: rosePineMoon.iris,
    editorBg: rosePineMoon.highlightLow,
    editorGrid: 'rgb(110 106 134 / 10%)',
    panelMuted: rosePineMoon.highlightLow,
  }),
  preset('carbon-night', 'Carbon Night', 'dark', {
    ...baseDark,
    background: '#121416',
    panel: '#1a1d20',
    paper: '#22262a',
    ink: '#f4f6f8',
    muted: '#aeb6bf',
    line: '#31363c',
    lineStrong: '#59616b',
    accent: '#8fb4ff',
    accentStrong: '#6f9bf6',
    editorBg: '#171a1d',
    editorGrid: 'rgb(143 180 255 / 5%)',
    panelMuted: '#22272c',
  }),
  preset('deep-slate', 'Deep Slate', 'dark', {
    ...baseDark,
    background: '#101722',
    panel: '#162131',
    paper: '#1e2a3a',
    ink: '#f3f7fb',
    muted: '#a7b4c3',
    line: '#2d3b4d',
    lineStrong: '#56687d',
    accent: '#76a8ff',
    accentStrong: '#4f8ce8',
    editorBg: '#121b28',
    editorGrid: 'rgb(118 168 255 / 5%)',
    panelMuted: '#1d2a3b',
  }),
  preset('moss-night', 'Moss Night', 'dark', {
    ...baseDark,
    background: '#121a16',
    panel: '#18231d',
    paper: '#202d26',
    ink: '#eef7f1',
    muted: '#a8b9ad',
    line: '#2f4036',
    lineStrong: '#5a6f62',
    accent: '#8dcc9f',
    accentStrong: '#6eb985',
    success: '#8dcc9f',
    warning: '#e6c06a',
    danger: '#ef8b7f',
    focus: '#a6ddb4',
    editorBg: '#141f18',
    editorGrid: 'rgb(141 204 159 / 5%)',
    panelMuted: '#1e2a23',
  }),
  preset('ink-blue', 'Ink Blue', 'dark', {
    ...baseDark,
    background: '#0f1624',
    panel: '#151f31',
    paper: '#1d2a40',
    ink: '#f5f8ff',
    muted: '#a7b4c8',
    line: '#2a3850',
    lineStrong: '#53647e',
    accent: '#7aa7f7',
    accentStrong: '#5b8ee8',
    editorBg: '#101929',
    editorGrid: 'rgb(122 167 247 / 5%)',
    panelMuted: '#1b2940',
  }),
  preset('espresso-ink', 'Espresso Ink', 'dark', {
    ...baseDark,
    background: '#1b1714',
    panel: '#241f1b',
    paper: '#2e2923',
    ink: '#faf4ec',
    muted: '#c0b2a4',
    line: '#433930',
    lineStrong: '#6b5a4c',
    accent: '#d9a35f',
    accentStrong: '#bf8540',
    warning: '#efc47b',
    editorBg: '#201b17',
    editorGrid: 'rgb(217 163 95 / 5%)',
    panelMuted: '#2a241f',
  }),
  preset('matrix-focus', 'Matrix Focus', 'dark', {
    ...baseDark,
    background: '#101713',
    panel: '#151f19',
    paper: '#1b2820',
    ink: '#eef8f1',
    muted: '#9fb2a5',
    line: '#2b3a30',
    lineStrong: '#526557',
    accent: '#7ccf8a',
    accentStrong: '#61b770',
    success: '#7ccf8a',
    warning: '#dfc86d',
    danger: '#ee827b',
    focus: '#99dfa3',
    editorBg: '#111a15',
    editorGrid: 'rgb(124 207 138 / 5%)',
    panelMuted: '#1b261f',
  }),
  preset('graphite-night', 'Graphite Night', 'dark', {
    ...baseDark,
    background: '#111111',
    panel: '#191919',
    paper: '#242424',
    ink: '#f5f5f5',
    muted: '#b4b4b4',
    line: '#333333',
    lineStrong: '#5f5f5f',
    accent: '#a8c7fa',
    accentStrong: '#7da7f5',
    editorBg: '#151515',
    editorGrid: 'rgb(168 199 250 / 5%)',
    panelMuted: '#202020',
    density: 'compact',
  }),
  preset('harbor-night', 'Harbor Night', 'dark', {
    ...baseDark,
    background: '#0f171b',
    panel: '#162329',
    paper: '#203039',
    ink: '#eef7fa',
    muted: '#a8bac2',
    line: '#2d434d',
    lineStrong: '#58707b',
    accent: '#83c5dd',
    accentStrong: '#5db1cf',
    success: '#8ad0ad',
    editorBg: '#111c21',
    editorGrid: 'rgb(131 197 221 / 5%)',
    panelMuted: '#1c2b32',
  }),
  preset('cedar-night', 'Cedar Night', 'dark', {
    ...baseDark,
    background: '#141815',
    panel: '#1d241f',
    paper: '#27302a',
    ink: '#f1f8f2',
    muted: '#a9b8ad',
    line: '#364338',
    lineStrong: '#60705f',
    accent: '#9dcf8c',
    accentStrong: '#7fba6e',
    success: '#9dcf8c',
    warning: '#e5c36f',
    danger: '#ed8c83',
    editorBg: '#171d19',
    editorGrid: 'rgb(157 207 140 / 5%)',
    panelMuted: '#232b25',
  }),
  preset('midnight-mail', 'Midnight Mail', 'dark', {
    ...baseDark,
    background: '#0c1220',
    panel: '#121a2b',
    paper: '#1c2638',
    ink: '#f4f7ff',
    muted: '#aab6c9',
    line: '#29364d',
    lineStrong: '#536580',
    accent: '#8bb5ff',
    accentStrong: '#6a9df2',
    editorBg: '#0f1728',
    editorGrid: 'rgb(139 181 255 / 5%)',
    panelMuted: '#182236',
    density: 'compact',
  }),
  preset('aubergine-office', 'Aubergine Office', 'dark', {
    ...baseDark,
    background: '#18131b',
    panel: '#211b27',
    paper: '#2b2434',
    ink: '#f8f3fb',
    muted: '#b8adbf',
    line: '#3e3448',
    lineStrong: '#685b73',
    accent: '#c1a4ef',
    accentStrong: '#a884df',
    warning: '#e8c074',
    danger: '#ee8d92',
    editorBg: '#1b1620',
    editorGrid: 'rgb(193 164 239 / 5%)',
    panelMuted: '#28212f',
  }),
  preset('noir-letter', 'Noir Letter', 'dark', {
    ...baseDark,
    background: '#090b0f',
    panel: '#11141a',
    paper: '#1b2028',
    ink: '#f8fafc',
    muted: '#b7c0ca',
    line: '#2b323d',
    lineStrong: '#596574',
    accent: '#d0d7de',
    accentStrong: '#ffffff',
    editorBg: '#0d1015',
    editorGrid: 'rgb(208 215 222 / 5%)',
    panelMuted: '#171b22',
    density: 'compact',
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

export const THEME_PRESET_INDEX: ThemePresetIndexEntry[] = [
  {
    id: 'normal-light',
    category: 'Core',
    keywords: ['default', 'icon', 'light', 'balanced', 'blue'],
  },
  {
    id: 'normal-dark',
    category: 'Core',
    keywords: ['default', 'icon', 'dark', 'balanced', 'blue'],
  },
  {
    id: 'gmail-clean',
    category: 'Gmail',
    keywords: ['gmail', 'google', 'clean', 'white', 'blue'],
  },
  {
    id: 'minimal-ink',
    category: 'Editorial',
    keywords: ['minimal', 'ink', 'neutral', 'writing'],
  },
  {
    id: 'warm-paper',
    category: 'Paper',
    keywords: ['warm', 'paper', 'cream', 'soft'],
  },
  {
    id: 'porcelain-blue',
    category: 'Focus',
    keywords: ['porcelain', 'blue', 'cool', 'calm'],
  },
  {
    id: 'sage-office',
    category: 'Focus',
    keywords: ['sage', 'green', 'office', 'calm'],
  },
  {
    id: 'zinc-desk',
    category: 'Core',
    keywords: ['zinc', 'neutral', 'desk', 'gray'],
  },
  {
    id: 'cloud-letter',
    category: 'Paper',
    keywords: ['cloud', 'letter', 'soft', 'blue'],
  },
  {
    id: 'oat-studio',
    category: 'Paper',
    keywords: ['oat', 'paper', 'warm', 'studio'],
  },
  {
    id: 'blueprint-light',
    category: 'Focus',
    keywords: ['blueprint', 'technical', 'blue', 'light'],
  },
  {
    id: 'paper-white',
    category: 'Gmail',
    keywords: ['paper', 'white', 'compact', 'gmail', 'clean'],
  },
  {
    id: 'graphite-paper',
    category: 'Core',
    keywords: ['graphite', 'paper', 'compact', 'neutral', 'gray'],
  },
  {
    id: 'mist-green',
    category: 'Focus',
    keywords: ['mist', 'green', 'calm', 'focus', 'office'],
  },
  {
    id: 'harbor-letter',
    category: 'Focus',
    keywords: ['harbor', 'letter', 'teal', 'blue', 'calm'],
  },
  {
    id: 'newsprint',
    category: 'Editorial',
    keywords: ['newsprint', 'editorial', 'neutral', 'compact', 'writing'],
  },
  {
    id: 'copper-memo',
    category: 'Paper',
    keywords: ['copper', 'memo', 'warm', 'paper', 'amber'],
  },
  {
    id: 'orchid-note',
    category: 'Editorial',
    keywords: ['orchid', 'note', 'lilac', 'purple', 'editorial'],
  },
  {
    id: 'rose-pine',
    category: 'Rosé Pine',
    keywords: [
      'rose',
      'pine',
      'main',
      'official',
      'palette',
      'soho',
      'editorial',
      'dark',
    ],
  },
  {
    id: 'rose-pine-dawn',
    category: 'Rosé Pine',
    keywords: [
      'rose',
      'pine',
      'dawn',
      'rose-pine-dawn',
      'official',
      'palette',
      'soho',
      'light',
      'soft',
    ],
  },
  {
    id: 'rose-pine-moon',
    category: 'Rosé Pine',
    keywords: [
      'rose',
      'pine',
      'moon',
      'rose-pine-moon',
      'official',
      'palette',
      'soho',
      'dark',
      'soft',
    ],
  },
  {
    id: 'carbon-night',
    category: 'Core',
    keywords: ['carbon', 'night', 'neutral', 'dark'],
  },
  {
    id: 'deep-slate',
    category: 'Core',
    keywords: ['slate', 'deep', 'dark', 'blue'],
  },
  {
    id: 'moss-night',
    category: 'Focus',
    keywords: ['moss', 'green', 'night', 'focus'],
  },
  {
    id: 'ink-blue',
    category: 'Focus',
    keywords: ['ink', 'blue', 'night', 'dark'],
  },
  {
    id: 'espresso-ink',
    category: 'Paper',
    keywords: ['espresso', 'warm', 'brown', 'dark'],
  },
  {
    id: 'matrix-focus',
    category: 'Focus',
    keywords: ['matrix', 'green', 'focus', 'dark'],
  },
  {
    id: 'graphite-night',
    category: 'Core',
    keywords: ['graphite', 'night', 'compact', 'neutral', 'dark'],
  },
  {
    id: 'harbor-night',
    category: 'Focus',
    keywords: ['harbor', 'teal', 'blue', 'night', 'dark'],
  },
  {
    id: 'cedar-night',
    category: 'Focus',
    keywords: ['cedar', 'green', 'night', 'calm', 'dark'],
  },
  {
    id: 'midnight-mail',
    category: 'Gmail',
    keywords: ['midnight', 'mail', 'blue', 'compact', 'dark'],
  },
  {
    id: 'aubergine-office',
    category: 'Editorial',
    keywords: ['aubergine', 'office', 'purple', 'editorial', 'dark'],
  },
  {
    id: 'noir-letter',
    category: 'Core',
    keywords: ['noir', 'letter', 'compact', 'black', 'dark'],
  },
  {
    id: 'high-contrast-light',
    category: 'Contrast',
    keywords: ['high', 'contrast', 'accessible', 'light'],
  },
  {
    id: 'high-contrast-dark',
    category: 'Contrast',
    keywords: ['high', 'contrast', 'accessible', 'dark'],
  },
]

const legacyThemePresetIds: Record<string, string> = {
  'rose-light': 'rose-pine-dawn',
  'rose-dark': 'rose-pine-moon',
}

function normalizePresetId(id: string): string {
  return legacyThemePresetIds[id] ?? id
}

export function getThemePresetIndexEntry(
  id: string,
): ThemePresetIndexEntry | undefined {
  const normalizedId = normalizePresetId(id)
  return THEME_PRESET_INDEX.find((entry) => entry.id === normalizedId)
}

export function searchThemePresets(
  query: string,
  mode?: ThemeMode,
  category?: ThemePresetCategory | 'All',
): ThemeDefinition[] {
  const normalizedQuery = query.trim().toLowerCase()

  return THEME_PRESETS.filter((theme) => {
    if (mode && theme.mode !== mode) {
      return false
    }

    const index = getThemePresetIndexEntry(theme.id)
    if (category && category !== 'All' && index?.category !== category) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchable = [
      theme.id,
      theme.name,
      theme.mode,
      index?.category,
      ...(index?.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase()

    return searchable.includes(normalizedQuery)
  })
}

export const defaultThemeId = 'normal-light'
export const defaultDarkThemeId = 'normal-dark'

export function getThemeById(id: string): ThemeDefinition | undefined {
  const normalizedId = normalizePresetId(id)
  return THEME_PRESETS.find((theme) => theme.id === normalizedId)
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
  const primaryForeground = getReadableForeground(
    theme.tokens.accent,
    theme.mode === 'dark' ? '#111827' : '#ffffff',
  )
  const emailPaper = '#ffffff'
  const emailInk = '#1f2933'
  const emailMuted = '#4b5563'
  const emailLine = 'rgb(31 41 51 / 14%)'

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
    '--primary': theme.tokens.accent,
    '--primary-strong': theme.tokens.accentStrong,
    '--primary-foreground': primaryForeground,
    '--surface-muted': theme.tokens.panelMuted,
    '--control-radius': '8px',
    '--chip-radius': '999px',
    '--shadow-control':
      '0 1px 2px color-mix(in srgb, var(--ink) 12%, transparent)',
    '--email-paper': emailPaper,
    '--email-ink': emailInk,
    '--email-muted': emailMuted,
    '--email-line': emailLine,
    '--color-background': theme.tokens.background,
    '--color-foreground': theme.tokens.ink,
    '--color-card': theme.tokens.panel,
    '--color-card-foreground': theme.tokens.ink,
    '--color-muted': theme.tokens.panelMuted,
    '--color-muted-foreground': theme.tokens.muted,
    '--color-border': theme.tokens.line,
    '--color-ring': theme.tokens.focus,
    '--color-primary': theme.tokens.accent,
    '--color-primary-foreground': primaryForeground,
    '--color-destructive': theme.tokens.danger,
    '--re-bg': emailPaper,
    '--re-bg-active': theme.tokens.panelMuted,
    '--re-border': emailLine,
    '--re-text': emailInk,
    '--re-text-muted': emailMuted,
    '--re-hover': theme.tokens.panelMuted,
    '--re-active': theme.tokens.panelMuted,
    '--re-pressed': theme.tokens.line,
    '--re-separator': theme.tokens.line,
    '--re-danger': theme.tokens.danger,
  }
}

function getReadableForeground(color: string, fallback: string): string {
  const contrastWithWhite = getContrastRatio(color, '#ffffff')
  const contrastWithInk = getContrastRatio(color, '#111827')

  if (contrastWithWhite === null || contrastWithInk === null) {
    return fallback
  }

  return contrastWithWhite >= contrastWithInk ? '#ffffff' : '#111827'
}

function getContrastRatio(
  foreground: string,
  background: string,
): number | null {
  const foregroundRgb = parseHexColor(foreground)
  const backgroundRgb = parseHexColor(background)

  if (!foregroundRgb || !backgroundRgb) {
    return null
  }

  const lighter = Math.max(
    getRelativeLuminance(foregroundRgb),
    getRelativeLuminance(backgroundRgb),
  )
  const darker = Math.min(
    getRelativeLuminance(foregroundRgb),
    getRelativeLuminance(backgroundRgb),
  )

  return (lighter + 0.05) / (darker + 0.05)
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]

  if (!hex) {
    return null
  }

  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : hex

  return [0, 2, 4].map((start) =>
    Number.parseInt(fullHex.slice(start, start + 2), 16),
  ) as [number, number, number]
}

function getRelativeLuminance([red, green, blue]: [
  number,
  number,
  number,
]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
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
  if (/[;{}<>]|url\s*\(|expression\s*\(|javascript\s*:/i.test(value)) {
    return false
  }

  return /^(#[0-9a-f]{3,8}|rgb\([\d\s.,%/+-]+\)|rgba\([\d\s.,%/+-]+\)|hsl\([\d\s.,%/+-]+\)|hsla\([\d\s.,%/+-]+\)|[a-z]+)$/i.test(
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
