import { describe, expect, it } from 'vitest'

import {
  createThemeStyle,
  getThemeById,
  getThemePresetIndexEntry,
  parseThemeJson,
  resolveTheme,
  searchThemePresets,
  serializeTheme,
  THEME_PRESET_INDEX,
  THEME_PRESETS,
} from './themes'

describe('theme utilities', () => {
  it('round-trips preset themes as editable JSON', () => {
    const preset = THEME_PRESETS[0]
    const result = parseThemeJson(serializeTheme(preset))

    expect(result).toEqual({ ok: true, theme: preset })
  })

  it('rejects unsafe token values from pasted theme JSON', () => {
    const result = parseThemeJson(
      JSON.stringify({
        version: 1,
        name: 'Unsafe Theme',
        mode: 'light',
        tokens: {
          ...THEME_PRESETS[0].tokens,
          accent: 'url(javascript:alert(1))',
        },
      }),
    )

    expect(result).toEqual({
      ok: false,
      error:
        'Theme tokens must contain safe colors, radius, shadow, and density values.',
    })
  })

  it('rejects unsafe function text hidden inside color-like tokens', () => {
    const result = parseThemeJson(
      JSON.stringify({
        version: 1,
        name: 'Unsafe Theme',
        mode: 'light',
        tokens: {
          ...THEME_PRESETS[0].tokens,
          panel: 'rgb(url(javascript:alert(1)))',
        },
      }),
    )

    expect(result).toEqual({
      ok: false,
      error:
        'Theme tokens must contain safe colors, radius, shadow, and density values.',
    })
  })

  it('includes official Rosé Pine variants with compatible preset ids', () => {
    expect(
      THEME_PRESETS.find((theme) => theme.id === 'rose-pine'),
    ).toMatchObject({
      name: 'Rosé Pine',
      mode: 'dark',
      tokens: {
        background: '#191724',
        panel: '#1f1d2e',
        paper: '#26233a',
        ink: '#e0def4',
        panelMuted: '#21202e',
      },
    })
    expect(
      THEME_PRESETS.find((theme) => theme.id === 'rose-pine-dawn'),
    ).toMatchObject({
      name: 'Rosé Pine Dawn',
      mode: 'light',
      tokens: {
        background: '#faf4ed',
        panel: '#fffaf3',
        paper: '#f2e9e1',
        ink: '#575279',
        panelMuted: '#f4ede8',
      },
    })
    expect(
      THEME_PRESETS.find((theme) => theme.id === 'rose-pine-moon'),
    ).toMatchObject({
      name: 'Rosé Pine Moon',
      mode: 'dark',
      tokens: {
        background: '#232136',
        panel: '#2a273f',
        paper: '#393552',
        ink: '#e0def4',
        panelMuted: '#2a283e',
      },
    })
  })

  it('indexes every built-in preset and searches official Rosé Pine aliases', () => {
    expect(THEME_PRESET_INDEX).toHaveLength(THEME_PRESETS.length)

    for (const theme of THEME_PRESETS) {
      expect(getThemePresetIndexEntry(theme.id)).toBeDefined()
    }

    expect(searchThemePresets('main').map((theme) => theme.id)).toContain(
      'rose-pine',
    )
    expect(searchThemePresets('dawn').map((theme) => theme.id)).toContain(
      'rose-pine-dawn',
    )
    expect(searchThemePresets('moon').map((theme) => theme.id)).toContain(
      'rose-pine-moon',
    )
    expect(
      searchThemePresets('rose-pine-dawn').map((theme) => theme.id),
    ).toEqual(['rose-pine-dawn'])

    const officialIds = searchThemePresets('official').map((theme) => theme.id)
    expect(officialIds).toEqual(
      expect.arrayContaining(['rose-pine', 'rose-pine-dawn', 'rose-pine-moon']),
    )
  })

  it('resolves legacy rose preset ids to official variant ids', () => {
    expect(getThemeById('rose-light')?.id).toBe('rose-pine-dawn')
    expect(getThemeById('rose-dark')?.id).toBe('rose-pine-moon')
    expect(getThemePresetIndexEntry('rose-light')?.id).toBe('rose-pine-dawn')
    expect(getThemePresetIndexEntry('rose-dark')?.id).toBe('rose-pine-moon')
  })

  it('searches the expanded catalog by query, mode, and category', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(35)
    expect(
      searchThemePresets('compact', undefined, 'Core').map((theme) => theme.id),
    ).toEqual(expect.arrayContaining(['graphite-paper', 'graphite-night']))
    expect(
      searchThemePresets('gmail', 'dark', 'Gmail').map((theme) => theme.id),
    ).toEqual(expect.arrayContaining(['midnight-mail']))
    expect(searchThemePresets('orchid', 'light', 'Editorial')).toHaveLength(1)
  })

  it('resolves system mode to light or dark bundled defaults', () => {
    expect(resolveTheme('system', 'rose-pine', undefined, false).id).toBe(
      'normal-light',
    )
    expect(resolveTheme('system', 'normal-light', undefined, true).id).toBe(
      'normal-dark',
    )
  })

  it('generates portal-safe readable primary and email tokens', () => {
    const darkPreset = THEME_PRESETS.find((theme) => theme.id === 'normal-dark')

    expect(darkPreset).toBeDefined()

    const style = createThemeStyle(darkPreset!)
    expect(style['--primary']).toBe(darkPreset!.tokens.accent)
    expect(style['--primary-foreground']).toBe('#111827')
    expect(style['--email-paper']).toBe('#ffffff')
    expect(style['--email-ink']).toBe('#1f2933')
    expect(style['--re-text']).toBe('#1f2933')
  })
})
