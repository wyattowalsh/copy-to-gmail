import DOMPurify from 'dompurify'

export type EmailBodyAnalysis = {
  html: string
  text: string
  links: string[]
  unsafeLinks: string[]
  unsupportedElements: string[]
}

const ALLOWED_ELEMENTS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const REMOVE_WITH_CONTENT = new Set([
  'embed',
  'iframe',
  'math',
  'meta',
  'object',
  'script',
  'style',
  'svg',
  'template',
])

const GLOBAL_ATTRIBUTES = new Set([
  'align',
  'aria-label',
  'dir',
  'lang',
  'role',
  'style',
  'title',
])

const ELEMENT_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'name']),
  table: new Set(['cellpadding', 'cellspacing', 'border']),
  td: new Set(['colspan', 'rowspan', 'width']),
  th: new Set(['colspan', 'rowspan', 'scope', 'width']),
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-collapse',
  'border-color',
  'border-left',
  'border-radius',
  'border-right',
  'border-spacing',
  'border-style',
  'border-top',
  'border-width',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'overflow-wrap',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'table-layout',
  'text-align',
  'text-decoration',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
])

export function getPasteableBodyHtml(fullHtml: string): string {
  const trimmed = fullHtml.trim()

  if (!trimmed) {
    return ''
  }

  try {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    const bodyHtml = doc.body?.innerHTML.trim() || trimmed
    return removeHtmlComments(bodyHtml)
  } catch {
    return removeHtmlComments(trimmed)
  }
}

export function sanitizeEmailBodyHtml(fullHtml: string): string {
  const bodyHtml = getPasteableBodyHtml(fullHtml)

  if (!bodyHtml) {
    return ''
  }

  try {
    const purifiedHtml = DOMPurify.sanitize(bodyHtml, {
      ALLOW_DATA_ATTR: false,
      ALLOWED_ATTR: Array.from(
        new Set([
          ...GLOBAL_ATTRIBUTES,
          ...Object.values(ELEMENT_ATTRIBUTES).flatMap((attributes) =>
            Array.from(attributes),
          ),
        ]),
      ),
      ALLOWED_TAGS: Array.from(ALLOWED_ELEMENTS),
    })
    const doc = new DOMParser().parseFromString(purifiedHtml, 'text/html')
    sanitizeChildren(doc.body)
    return doc.body.innerHTML.trim()
  } catch {
    return sanitizeWithTextFallback(bodyHtml)
  }
}

export function analyzeEmailBody(fullHtml: string): EmailBodyAnalysis {
  const originalBodyHtml = getPasteableBodyHtml(fullHtml)
  const html = sanitizeEmailBodyHtml(fullHtml)
  const text = stripHtml(html)

  try {
    const originalDoc = new DOMParser().parseFromString(
      originalBodyHtml,
      'text/html',
    )
    const safeDoc = new DOMParser().parseFromString(html, 'text/html')
    const links = Array.from(safeDoc.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href')?.trim() ?? '')
      .filter(Boolean)
    const unsafeLinks = Array.from(originalDoc.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href')?.trim() ?? '')
      .filter((href) => Boolean(href) && !isSafeUrl(href))
    const unsupportedElements = Array.from(
      originalDoc.body.querySelectorAll(
        'iframe, object, embed, script, style, svg, math',
      ),
    ).map((element) => element.tagName.toLowerCase())

    return { html, text, links, unsafeLinks, unsupportedElements }
  } catch {
    return { html, text, links: [], unsafeLinks: [], unsupportedElements: [] }
  }
}

export function stripHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(
      addBlockSpacing(html),
      'text/html',
    )
    return normalizeWhitespace(doc.body?.textContent ?? '')
  } catch {
    const withoutTags = addBlockSpacing(html).replace(/<[^>]*>/g, ' ')
    return normalizeWhitespace(withoutTags)
  }
}

function sanitizeChildren(parent: ParentNode): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove()
      continue
    }

    if (!(node instanceof Element)) {
      continue
    }

    const tagName = node.tagName.toLowerCase()

    if (REMOVE_WITH_CONTENT.has(tagName)) {
      node.remove()
      continue
    }

    if (!ALLOWED_ELEMENTS.has(tagName)) {
      node.replaceWith(...Array.from(node.childNodes))
      sanitizeChildren(parent)
      continue
    }

    sanitizeAttributes(node, tagName)
    sanitizeChildren(node)
  }
}

function sanitizeAttributes(element: Element, tagName: string): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim()
    const elementAttributes = ELEMENT_ATTRIBUTES[tagName]
    const isAllowed =
      GLOBAL_ATTRIBUTES.has(name) || elementAttributes?.has(name)

    if (!isAllowed || name.startsWith('on') || name === 'srcdoc') {
      element.removeAttribute(attribute.name)
      continue
    }

    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (name === 'style' && !isSafeInlineStyle(value)) {
      element.removeAttribute(attribute.name)
    }
  }

  if (tagName === 'a' && element.getAttribute('target') === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer')
  }
}

function isSafeUrl(value: string): boolean {
  if (!value || value.startsWith('#')) {
    return true
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false
  }

  try {
    const url = new URL(value)
    return SAFE_URL_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

function isSafeInlineStyle(value: string): boolean {
  if (
    /[{}<>]|expression\s*\(|javascript\s*:|url\s*\(|behavior\s*:|-moz-binding/i.test(
      value,
    )
  ) {
    return false
  }

  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .every((declaration) => {
      const separator = declaration.indexOf(':')

      if (separator <= 0) {
        return false
      }

      const property = declaration.slice(0, separator).trim().toLowerCase()
      const propertyValue = declaration.slice(separator + 1).trim()

      return (
        SAFE_STYLE_PROPERTIES.has(property) &&
        Boolean(propertyValue) &&
        !property.startsWith('-')
      )
    })
}

function sanitizeWithTextFallback(html: string): string {
  return escapeHtml(
    normalizeWhitespace(removeHtmlComments(html).replace(/<[^>]*>/g, ' ')),
  )
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function removeHtmlComments(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/g, '').trim()
}

function addBlockSpacing(value: string): string {
  return removeHtmlComments(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(
      /<\/(?:blockquote|div|h[1-6]|li|ol|p|pre|table|tbody|td|th|thead|tr|ul)>/gi,
      '$& ',
    )
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
