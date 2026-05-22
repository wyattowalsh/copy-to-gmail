import { describe, expect, it, vi } from 'vitest'

import { analyzeGmailReadiness, getClipboardCapabilities } from './readiness'

describe('analyzeGmailReadiness', () => {
  it('blocks copy when no browser copy path is available', () => {
    const report = analyzeGmailReadiness({
      html: '<p>Hello</p>',
      hasClipboardApi: false,
      hasFallbackCopy: false,
      hasRichClipboard: false,
    })

    expect(report.status).toBe('Copy blocked')
    expect(report.checks.find((check) => check.id === 'copy-path')?.state).toBe(
      'fail',
    )
  })

  it('warns instead of blocking when fallback copy is available', () => {
    const report = analyzeGmailReadiness({
      html: '<p>Hello</p>',
      hasClipboardApi: false,
      hasFallbackCopy: true,
      hasRichClipboard: false,
    })

    expect(report.status).toBe('Needs review')
    expect(report.checks.find((check) => check.id === 'copy-path')?.state).toBe(
      'warn',
    )
  })

  it('warns for unsafe links detected before sanitization', () => {
    const report = analyzeGmailReadiness({
      html: '<p><a href="javascript:alert(1)">bad</a></p>',
      hasClipboardApi: true,
      hasRichClipboard: true,
    })

    expect(report.status).toBe('Needs review')
    expect(
      report.checks.find((check) => check.id === 'safe-links')?.state,
    ).toBe('warn')
    expect(report.html).not.toContain('javascript:')
  })

  it('warns for empty subjects and malformed recipients without blocking copy', () => {
    const report = analyzeGmailReadiness({
      html: '<p>Hello</p>',
      hasFallbackCopy: true,
      recipients: { bcc: '', cc: 'bad-address', to: 'person@example.com' },
      subject: '',
    })

    expect(report.status).toBe('Needs review')
    expect(
      report.checks.find((check) => check.id === 'subject-line')?.state,
    ).toBe('warn')
    expect(
      report.checks.find((check) => check.id === 'recipients')?.state,
    ).toBe('warn')
  })
})

describe('getClipboardCapabilities', () => {
  it('detects rich HTML clipboard support', () => {
    const write = vi.fn()
    const supports = vi.fn().mockReturnValue(true)
    Object.assign(navigator, { clipboard: { write } })
    Object.assign(window, { ClipboardItem: { supports } })
    Object.assign(globalThis, { ClipboardItem: window.ClipboardItem })
    Object.assign(document, { execCommand: vi.fn() })

    expect(getClipboardCapabilities()).toEqual({
      hasClipboardApi: true,
      hasFallbackCopy: true,
      hasRichClipboard: true,
    })
    expect(supports).toHaveBeenCalledWith('text/html')
  })
})
