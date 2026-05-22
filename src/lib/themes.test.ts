import { describe, expect, it } from 'vitest'

import {
  parseThemeJson,
  resolveTheme,
  serializeTheme,
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

  it('includes simple rose light and rose dark presets', () => {
    expect(
      THEME_PRESETS.find((theme) => theme.id === 'rose-light'),
    ).toMatchObject({ name: 'Rose Light', mode: 'light' })
    expect(
      THEME_PRESETS.find((theme) => theme.id === 'rose-dark'),
    ).toMatchObject({ name: 'Rose Dark', mode: 'dark' })
  })

  it('resolves system mode to light or dark bundled defaults', () => {
    expect(resolveTheme('system', 'rose-pine', undefined, false).id).toBe(
      'normal-light',
    )
    expect(resolveTheme('system', 'normal-light', undefined, true).id).toBe(
      'normal-dark',
    )
  })
})
