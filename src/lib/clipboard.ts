import { sanitizeEmailBodyHtml, stripHtml } from './emailSafety'

export type RichHtmlClipboardInput = {
  html: string
  text?: string
}

export async function copyRichHtmlToClipboard(
  input: RichHtmlClipboardInput,
): Promise<void> {
  const html = sanitizeEmailBodyHtml(input.html)
  const text = input.text?.trim() || stripHtml(html)

  if (canWriteRichClipboard()) {
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })

    await navigator.clipboard.write([clipboardItem])
    return
  }

  if (copyWithContentEditableFallback(html)) {
    return
  }

  throw new Error(
    'Clipboard rich copy is unavailable. Manually select the preview content and copy it, then paste into Gmail compose with Plain text mode off.',
  )
}

function canWriteRichClipboard(): boolean {
  if (!window.ClipboardItem) {
    return false
  }

  const canWriteHtml =
    typeof ClipboardItem.supports !== 'function' ||
    ClipboardItem.supports('text/html')

  return Boolean(
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    canWriteHtml,
  )
}

function copyWithContentEditableFallback(html: string): boolean {
  const container = document.createElement('div')
  container.contentEditable = 'true'
  container.tabIndex = -1
  container.setAttribute('aria-hidden', 'true')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1px'
  container.style.height = '1px'
  container.style.overflow = 'hidden'
  container.innerHTML = html

  document.body.appendChild(container)

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(container)
  selection?.removeAllRanges()
  selection?.addRange(range)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    selection?.removeAllRanges()
    container.remove()
  }
}

export {
  getPasteableBodyHtml,
  sanitizeEmailBodyHtml,
  stripHtml,
} from './emailSafety'
