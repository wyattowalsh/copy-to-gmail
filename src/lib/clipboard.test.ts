import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyRichHtmlToClipboard } from './clipboard'

type MockClipboardItemShape = {
  data: Record<string, Blob>
}

type ClipboardWrite = (items: MockClipboardItemShape[]) => Promise<void>

type ClipboardItemSupports = (mimeType: string) => boolean

describe('copyRichHtmlToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setClipboard(undefined)
    setClipboardItem(undefined)
    document.body.innerHTML = ''
  })

  it('writes sanitized HTML and plain text to the rich Clipboard API', async () => {
    const write = vi.fn<ClipboardWrite>().mockResolvedValue(undefined)
    const supports = vi.fn<ClipboardItemSupports>().mockReturnValue(true)
    class MockClipboardItem {
      static supports(mimeType: string) {
        return supports(mimeType)
      }

      constructor(data: Record<string, Blob>) {
        Object.defineProperty(this, 'data', { value: data })
      }
    }

    setClipboard({ write })
    setClipboardItem(MockClipboardItem)

    await copyRichHtmlToClipboard({
      html: '<p onclick="alert(1)">Hello <strong>Gmail</strong></p>',
    })

    expect(write).toHaveBeenCalledTimes(1)
    const item = write.mock.calls[0][0][0]
    await expect(item.data['text/html'].text()).resolves.toBe(
      '<p>Hello <strong>Gmail</strong></p>',
    )
    await expect(item.data['text/plain'].text()).resolves.toBe('Hello Gmail')
  })

  it('uses a sanitized contenteditable fallback when rich clipboard is unavailable', async () => {
    const execCommand = vi.fn(() => true)
    let copiedHtml = ''

    execCommand.mockImplementation(() => {
      copiedHtml = document.body.firstElementChild?.innerHTML ?? ''
      return true
    })

    setExecCommand(execCommand)
    setClipboard(undefined)
    setClipboardItem(undefined)

    await copyRichHtmlToClipboard({
      html: '<p onmouseover="alert(1)"><a href="https://example.com">Link</a></p>',
    })

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(copiedHtml).toBe('<p><a href="https://example.com">Link</a></p>')
    expect(document.body).toBeEmptyDOMElement()
  })

  it('throws an actionable error when both copy paths are unavailable', async () => {
    setExecCommand(vi.fn(() => false))
    setClipboard(undefined)
    setClipboardItem(undefined)

    await expect(
      copyRichHtmlToClipboard({ html: '<p>Hello</p>' }),
    ).rejects.toThrow(/Manually select the preview content/)
  })
})

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
  })
}

function setClipboardItem(value: unknown) {
  Object.defineProperty(window, 'ClipboardItem', {
    value,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'ClipboardItem', {
    value,
    configurable: true,
  })
}

function setExecCommand(value: unknown) {
  Object.defineProperty(document, 'execCommand', {
    value,
    configurable: true,
  })
}
