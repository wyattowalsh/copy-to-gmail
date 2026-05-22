import { describe, expect, it } from 'vitest'

import {
  analyzeEmailBody,
  getPasteableBodyHtml,
  sanitizeEmailBodyHtml,
  stripHtml,
} from './emailSafety'

describe('emailSafety', () => {
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
})
