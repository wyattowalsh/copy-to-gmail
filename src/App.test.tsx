import React, { useImperativeHandle } from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

let currentEmail = {
  html: '<p>Hello <strong>Gmail</strong></p><p><a href="https://example.com">Link</a></p>',
  text: 'Hello Gmail Link',
}

const write = vi.fn().mockResolvedValue(undefined)
const writeText = vi.fn().mockResolvedValue(undefined)
const fetchMock = vi.fn()

vi.mock('@react-email/editor', () => ({
  EmailEditor: React.forwardRef(function MockEmailEditor(
    props: {
      onReady?: (ref: { getEmail: () => Promise<typeof currentEmail> }) => void
      onUpdate?: (ref: { getEmail: () => Promise<typeof currentEmail> }) => void
      className?: string
    },
    forwardedRef: React.ForwardedRef<{
      getEmail: () => Promise<typeof currentEmail>
    }>,
  ) {
    const { className, onReady, onUpdate } = props
    const api = React.useMemo(
      () => ({ getEmail: vi.fn(() => Promise.resolve(currentEmail)) }),
      [],
    )
    useImperativeHandle(forwardedRef, () => api)

    React.useEffect(() => {
      onReady?.(api)
      onUpdate?.(api)
    }, [api, onReady, onUpdate])

    return (
      <div className={className}>
        <div className="tiptap" contentEditable suppressContentEditableWarning>
          Mock editor
        </div>
      </div>
    )
  }),
}))

class MockClipboardItem {
  static supports() {
    return true
  }

  constructor(data: Record<string, Blob>) {
    Object.defineProperty(this, 'data', { value: data })
  }
}

describe('App', () => {
  beforeEach(() => {
    currentEmail = {
      html: '<p>Hello <strong>Gmail</strong></p><p><a href="https://example.com">Link</a></p>',
      text: 'Hello Gmail Link',
    }
    write.mockClear()
    writeText.mockClear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      jsonResponse({
        connected: false,
        needsConfig: true,
        scopes: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    setLocalStorage(createLocalStorage())
    setClipboard({ write, writeText })
    setClipboardItem(MockClipboardItem)
  })

  it('shows Gmail readiness and labels the editor surface', async () => {
    render(<App />)

    expect(await screen.findByText('Gmail readiness')).toBeInTheDocument()
    expect(await screen.findByText(/link ready for Gmail/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText('Email body editor')).toHaveAttribute(
        'aria-describedby',
        'editor-help',
      )
    })
  })

  it('opens the sanitized preview drawer with current source and plain-text views', async () => {
    currentEmail = {
      html: '<p onclick="alert(1)">Hello <strong>Gmail</strong></p><script>alert(1)</script><p>Current visual draft</p>',
      text: '',
    }
    const user = userEvent.setup()
    render(<App />)

    const trigger = screen.getByRole('button', {
      name: /open preview drawer/i,
    })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', {
      name: /gmail body preview/i,
    })
    expect(
      within(dialog).getByRole('button', { name: /^close$/i }),
    ).toHaveFocus()
    expect(within(dialog).getByText('Hello')).toBeInTheDocument()
    expect(dialog.innerHTML).not.toContain('onclick')
    expect(dialog.innerHTML).not.toContain('<script')

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /rendered/i, pressed: true }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /source/i, pressed: false }),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: /plain text/i }),
    )
    expect(
      within(dialog).getByText('Hello Gmail Current visual draft'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /source/i }))
    expect(
      within(dialog).getByText(/Current visual draft/i),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByText(/Product update/i),
    ).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('copies rich Gmail payload and announces success', async () => {
    const user = userEvent.setup()
    setClipboard({ write, writeText })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^copy for gmail$/i }))

    expect(write).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(/Copied rich email: HTML and plain text/i),
    ).toBeInTheDocument()
  })

  it('exports versioned draft JSON with subject and recipients', async () => {
    const user = userEvent.setup()
    const localWriteText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue(undefined)
    setClipboard({ write, writeText: localWriteText })
    render(<App />)

    fireEvent.change(screen.getByPlaceholderText(/add a gmail subject/i), {
      target: { value: 'Follow up' },
    })
    fireEvent.change(screen.getByPlaceholderText(/person@example.com/i), {
      target: { value: 'person@example.com' },
    })

    await user.click(screen.getByText(/more actions/i))
    await user.click(screen.getByRole('button', { name: /export json/i }))

    await waitFor(() => expect(localWriteText).toHaveBeenCalled())

    const exportedRaw = localWriteText.mock.calls.at(-1)?.[0]
    expect(typeof exportedRaw).toBe('string')
    const exported = JSON.parse(exportedRaw as string) as {
      recipients: { to: string }
      subject: string
      version: number
    }
    expect(exported.version).toBe(2)
    expect(exported.subject).toBe('Follow up')
    expect(exported.recipients.to).toBe('person@example.com')
  })

  it('supports source mode as a distinct code input with sanitized copy output', async () => {
    const user = userEvent.setup()
    setClipboard({ write, writeText })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^source$/i }))

    const sourceEditor = await screen.findByLabelText('Source HTML')
    fireEvent.change(sourceEditor, {
      target: {
        value: '<p onclick="alert(1)">Hi <a href="/relative">relative</a></p>',
      },
    })

    expect(await screen.findByText('1 unsafe links')).toBeInTheDocument()
    expect(
      await screen.findByText(/1 unsafe link was removed/i),
    ).toBeInTheDocument()

    await user.click(screen.getByText(/more actions/i))
    await user.click(screen.getByRole('button', { name: /sanitized html/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('<p>Hi <a>relative</a></p>')
    })
  })

  it('applies pasted custom theme JSON from the settings modal', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    expect(
      within(dialog).getByRole('button', { name: /^close$/i }),
    ).toHaveFocus()
    const themeJson = within(dialog).getByLabelText('Theme JSON')
    fireEvent.change(themeJson, {
      target: {
        value: JSON.stringify({
          version: 1,
          name: 'Test Theme',
          mode: 'dark',
          tokens: {
            background: '#000000',
            panel: '#111111',
            paper: '#181818',
            ink: '#ffffff',
            muted: '#dddddd',
            line: '#333333',
            lineStrong: '#444444',
            accent: '#ff99cc',
            accentStrong: '#ff66aa',
            success: '#88ffaa',
            warning: '#ffd166',
            danger: '#ff6680',
            focus: '#99ccff',
            editorBg: '#050505',
            editorGrid: 'rgb(255 255 255 / 5%)',
            panelMuted: '#1f1f1f',
            shadow: '0 1px 2px rgb(0 0 0 / 20%)',
            radius: '12px',
            density: 'compact',
          },
        }),
      },
    })

    await user.click(
      within(dialog).getByRole('button', { name: /apply json/i }),
    )

    expect(
      await screen.findByText(/Applied custom theme.*Test Theme/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-theme-mode', 'dark')
    expect(screen.getByRole('main')).toHaveAttribute('data-density', 'compact')
  })

  it('restores focus to the settings opener after Escape closes the modal', async () => {
    const user = userEvent.setup()
    render(<App />)

    const trigger = screen.getByRole('button', { name: /^settings$/i })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    expect(
      within(dialog).getByRole('button', { name: /^close$/i }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('hides background content and locks page scroll while a modal layer is open', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    await screen.findByRole('dialog', { name: /settings/i })
    expect(document.querySelector('.app-content')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(document.querySelector('.app-content')).not.toHaveAttribute(
        'aria-hidden',
      ),
    )
    expect(document.body.style.overflow).toBe('')
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

function setLocalStorage(value: unknown) {
  Object.defineProperty(window, 'localStorage', {
    value,
    configurable: true,
  })
}

function createLocalStorage() {
  const items = new Map<string, string>()

  return {
    clear: vi.fn(() => items.clear()),
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    removeItem: vi.fn((key: string) => items.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value)
    }),
  }
}

function jsonResponse(value: unknown, status = 200) {
  return {
    json: () => Promise.resolve(value),
    ok: status >= 200 && status < 300,
    status,
  }
}
