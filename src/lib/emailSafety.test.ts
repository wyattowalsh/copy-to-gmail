import DOMPurify from 'dompurify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  analyzeEmailBody,
  getPasteableBodyHtml,
  sanitizeEmailBodyHtml,
  stripHtml,
} from './emailSafety'

describe('emailSafety', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts only body HTML and removes comments', () => {
    expect(
      getPasteableBodyHtml(`
        <!doctype html>
        <html>
          <head><title>Ignore</title></head>
          <body><!-- nope --><p>Hello <strong>Gmail</strong></p></body>
        </html>
      `),
    ).toBe('<p>Hello <strong>Gmail</strong></p>')
  })

  it('sanitizes active content and unsafe attributes while preserving email markup', () => {
    const html = sanitizeEmailBodyHtml(`
      <body>
        <p onclick="alert(1)" style="color: red">Hello</p>
        <a href="javascript:alert(1)" target="_blank">bad</a>
        <a href="https://example.com" target="_blank">good</a>
        <script>alert(1)</script>
        <span data-temp="x">kept text</span>
      </body>
    `)

    expect(html).toContain('<p style="color: red">Hello</p>')
    expect(html).toContain(
      '<a target="_blank" rel="noopener noreferrer">bad</a>',
    )
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">good</a>',
    )
    expect(html).toContain('<span>kept text</span>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script')
  })

  it('removes class hooks and layout styles that could affect the app shell', () => {
    const html = sanitizeEmailBodyHtml(`
      <p class="app-shell" style="position: fixed; inset: 0; z-index: 9999; color: red">
        Cover
      </p>
      <p style="font-weight: 700; text-align: center">Safe style</p>
    `)

    expect(html).toContain('Cover')
    expect(html).toContain(
      '<p style="font-weight: 700; text-align: center">Safe style</p>',
    )
    expect(html).not.toContain('class=')
    expect(html).not.toContain('position')
    expect(html).not.toContain('z-index')
    expect(html).not.toContain('inset')
  })

  it('normalizes plain text from sanitized HTML', () => {
    expect(stripHtml('<p>Hello</p><p><strong>Gmail</strong></p>')).toBe(
      'Hello Gmail',
    )
  })

  it('reports unsafe links and unsupported source elements from original input', () => {
    const analysis = analyzeEmailBody(`
      <p><a href="javascript:alert(1)">bad</a></p>
      <svg><circle /></svg>
      <p><a href="https://example.com">good</a></p>
    `)

    expect(analysis.links).toEqual(['https://example.com'])
    expect(analysis.unsafeLinks).toEqual(['javascript:alert(1)'])
    expect(analysis.unsupportedElements).toContain('svg')
    expect(analysis.html).not.toContain('javascript:')
    expect(analysis.html).not.toContain('<svg')
  })

  it('removes relative links so Gmail-bound drafts keep explicit destinations', () => {
    const analysis = analyzeEmailBody(`
      <p><a href="/relative-path">relative</a></p>
      <p><a href="mailto:hello@example.com">email</a></p>
    `)

    expect(analysis.links).toEqual(['mailto:hello@example.com'])
    expect(analysis.unsafeLinks).toEqual(['/relative-path'])
    expect(analysis.html).toContain('<a>relative</a>')
    expect(analysis.html).toContain(
      '<a href="mailto:hello@example.com">email</a>',
    )
  })

  it('fails closed to text if the primary sanitizer path is unavailable', () => {
    vi.spyOn(DOMPurify, 'sanitize').mockImplementation(() => {
      throw new Error('sanitizer unavailable')
    })

    const html = sanitizeEmailBodyHtml(`
      <p>
        <a href=javascript:alert(1)>Click</a>
        <img src=x onerror="alert(1)">
        <template><script>bad</script></template>
      </p>
    `)

    expect(html).toContain('Click')
    expect(html).not.toContain('<')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('template')
  })
})
