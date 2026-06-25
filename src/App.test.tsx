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
import { settingsStorageKey } from './lib/settings'

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
    setMatchMedia(false)
    setClipboard({ write, writeText })
    setClipboardItem(MockClipboardItem)
    window.history.replaceState({}, '', '/')
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

  it('keeps the composer mounted when Gmail status omits optional arrays', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        connected: false,
        needsConfig: false,
      }),
    )

    render(<App />)

    expect(await screen.findByText('Body canvas')).toBeInTheDocument()
    expect(
      await screen.findAllByText(/gmail sync is optional and disconnected/i),
    ).not.toHaveLength(0)
  })

  it('surfaces body metrics next to the editor and focuses editing surfaces', async () => {
    const user = userEvent.setup()
    render(<App />)

    const editor = await screen.findByLabelText('Email body editor')
    expect(await screen.findByText('Body canvas')).toBeInTheDocument()
    expect(await screen.findByText('3 words')).toBeInTheDocument()
    expect(screen.getByText('16 chars')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focus editor/i }))
    await waitFor(() => expect(editor).toHaveFocus())

    await user.click(screen.getByRole('radio', { name: /^source$/i }))
    const source = await screen.findByLabelText('Source HTML')

    await user.click(screen.getByRole('button', { name: /focus editor/i }))
    await waitFor(() => expect(source).toHaveFocus())
  })

  it('collapses and expands the inspector without losing status summaries', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText('Gmail readiness')

    await user.click(
      screen.getByRole('button', { name: /collapse inspector/i }),
    )

    const rail = screen.getByRole('button', { name: /expand inspector/i })
    expect(rail).toHaveAttribute('aria-expanded', 'false')
    const chips = rail.querySelector<HTMLElement>('.inspector-rail-chips')
    expect(chips).not.toBeNull()
    expect(
      within(chips as HTMLElement).getByText(/setup needed/i),
    ).toBeVisible()
    expect(within(chips as HTMLElement).getByText(/2 issues/i)).toBeVisible()
    expect(within(chips as HTMLElement).getByText(/0 saved/i)).toBeVisible()
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(settingsStorageKey) ?? '{}',
      ) as Record<string, unknown>
      expect(stored.inspectorDefault).toBe('collapsed')
    })

    await user.click(rail)
    expect(
      screen.getByRole('button', { name: /collapse inspector/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('uses a collapsed inspector by default on narrow auto layouts', async () => {
    setMatchMedia((query) => query.includes('max-width: 1180px'))
    render(<App />)

    expect(
      await screen.findByRole('button', { name: /expand inspector/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Gmail readiness')).not.toBeInTheDocument()
  })

  it('collapses empty mobile metadata and expands the labeled fields on demand', async () => {
    const user = userEvent.setup()
    setMatchMedia(
      (query) =>
        query.includes('max-width: 820px') ||
        query.includes('max-width: 1180px'),
    )
    render(<App />)

    const toggle = await screen.findByRole('button', {
      name: /expand subject and recipients/i,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/no subject/i)).toBeVisible()
    expect(screen.getByText(/no recipients/i)).toBeVisible()
    expect(document.getElementById('draft-metadata-fields')).toHaveAttribute(
      'hidden',
    )

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      document.getElementById('draft-metadata-fields'),
    ).not.toHaveAttribute('hidden')
    expect(screen.getByPlaceholderText(/add a gmail subject/i)).toBeVisible()
    expect(screen.getByPlaceholderText(/person@example.com/i)).toBeVisible()
    expect(screen.getByLabelText(/^cc$/i)).toBeVisible()
    expect(screen.getByLabelText(/^bcc$/i)).toBeVisible()
  })

  it('keeps populated mobile metadata summarized while collapsed', async () => {
    const user = userEvent.setup()
    setMatchMedia(
      (query) =>
        query.includes('max-width: 820px') ||
        query.includes('max-width: 1180px'),
    )
    render(<App />)

    const toggle = await screen.findByRole('button', {
      name: /expand subject and recipients/i,
    })
    await user.click(toggle)

    fireEvent.change(screen.getByPlaceholderText(/add a gmail subject/i), {
      target: { value: 'Follow up' },
    })
    fireEvent.change(screen.getByPlaceholderText(/person@example.com/i), {
      target: { value: 'person@example.com' },
    })

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/follow up/i)).toBeVisible()
    expect(screen.getByText(/1 recipient/i)).toBeVisible()
  })

  it('marks the Source mode More actions menu as compact', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('radio', { name: /^source$/i }))
    await user.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menu')).toHaveAttribute(
      'data-menu-placement',
      'compact',
    )
  })

  it('keeps the visual More actions menu viewport-safe on narrow layouts', async () => {
    const user = userEvent.setup()
    setMatchMedia((query) => query.includes('max-width: 1180px'))
    render(<App />)

    await user.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menu')).toHaveAttribute(
      'data-menu-placement',
      'narrow',
    )
  })

  it('focus workspace hides metadata while preserving composer actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByLabelText(/draft metadata/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focus workspace/i }))

    expect(screen.queryByLabelText(/draft metadata/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /copy for gmail/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open preview drawer/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exit focus/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('applies workspace settings to metrics and default preview mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('3 words')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const settingsDialog = await screen.findByRole('dialog', {
      name: /settings/i,
    })
    await user.click(
      within(settingsDialog).getByRole('radio', { name: /^wide$/i }),
    )
    await user.click(
      within(settingsDialog).getByRole('radio', { name: /plain text/i }),
    )
    await user.click(
      within(settingsDialog).getByLabelText(/show editor metrics/i),
    )
    await user.click(
      within(settingsDialog).getByRole('button', { name: /^close$/i }),
    )

    await waitFor(() =>
      expect(screen.queryByText('3 words')).not.toBeInTheDocument(),
    )

    await user.click(
      screen.getByRole('button', { name: /open preview drawer/i }),
    )
    const preview = await screen.findByRole('dialog', {
      name: /gmail body preview/i,
    })
    expect(
      within(preview).getByRole('radio', {
        name: /plain text/i,
        checked: true,
      }),
    ).toBeInTheDocument()

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(settingsStorageKey) ?? '{}',
      ) as Record<string, unknown>
      expect(stored.editorCanvas).toBe('wide')
      expect(stored.defaultPreviewMode).toBe('plain')
      expect(stored.showEditorMetrics).toBe(false)
    })
  })

  it('promotes configured Gmail sync into the draft workflow and compacts an empty library', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const path = getRequestPath(input)

      if (path === '/api/library') {
        return Promise.resolve(jsonResponse(emptyLibraryBundle()))
      }

      return Promise.resolve(
        jsonResponse({
          connected: false,
          scopes: [],
        }),
      )
    })

    render(<App />)

    const workflow = await screen.findByRole('region', {
      name: /draft workflow/i,
    })
    const connect = within(workflow).getByRole('button', {
      name: /connect gmail/i,
    })
    expect(connect).toBeEnabled()
    expect(
      screen.getAllByRole('button', { name: /connect gmail/i }),
    ).toHaveLength(1)
    expect(within(workflow).getByText(/^gmail sync$/i)).toBeInTheDocument()
    expect(within(workflow).getByText(/^local only$/i)).toBeInTheDocument()

    expect(
      await screen.findByText(/no saved library items/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/^template$/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save current/i })).toBeEnabled()
  })

  it('shows setup-needed Gmail state in the workflow while keeping connect available', async () => {
    const user = userEvent.setup()
    render(<App />)

    const workflow = await screen.findByRole('region', {
      name: /draft workflow/i,
    })

    expect(within(workflow).getByText(/setup needed/i)).toBeInTheDocument()
    expect(
      within(workflow).getByText(
        /add google oauth config to enable gmail sync/i,
      ),
    ).toBeInTheDocument()
    const gmailActions = within(workflow).getByRole('button', {
      name: /connect gmail/i,
    })
    expect(gmailActions).toBeEnabled()

    await user.click(gmailActions)
    expect(
      screen.getByRole('menuitem', { name: /connect gmail/i }),
    ).not.toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('menuitem', { name: /refresh status/i }),
    ).toBeInTheDocument()
  })

  it('surfaces Gmail callback token failures with a retry-focused message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        connected: false,
        needsConfig: false,
        scopes: [],
      }),
    )
    window.history.replaceState({}, '', '/?gmail=error&reason=token')

    render(<App />)

    expect(
      await screen.findAllByText(/token exchange failed/i),
    ).not.toHaveLength(0)
    expect(window.location.search).toBe('')

    const workflow = screen.getByRole('region', {
      name: /draft workflow/i,
    })
    expect(
      within(workflow).getByRole('button', { name: /connect gmail/i }),
    ).toBeEnabled()
  })

  it('surfaces successful Gmail callback state and clears callback params', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        connected: true,
        email: 'person@example.com',
        scopes: ['https://www.googleapis.com/auth/gmail.compose'],
      }),
    )
    window.history.replaceState({}, '', '/?gmail=connected')

    render(<App />)

    expect(
      await screen.findAllByText(/gmail connected\. sync controls are ready/i),
    ).not.toHaveLength(0)
    expect(window.location.search).toBe('')
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
      within(dialog).getByRole('radio', { name: /rendered/i, checked: true }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('radio', { name: /source/i, checked: false }),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: /plain text/i }))
    expect(
      within(dialog).getByText('Hello Gmail Current visual draft'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: /source/i }))
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
    await user.click(screen.getByRole('menuitem', { name: /export json/i }))

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

    await user.click(screen.getByRole('radio', { name: /^source$/i }))

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
    await user.click(screen.getByRole('menuitem', { name: /sanitized html/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('<p>Hi <a>relative</a></p>')
    })
  })

  it('closes More actions when opening the preview drawer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /more actions/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /open preview drawer/i }),
    )

    await screen.findByRole('dialog', { name: /gmail body preview/i })
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    )
  })

  it('restores focus to More actions after a menu-launched form dialog closes', async () => {
    const user = userEvent.setup()
    render(<App />)

    const trigger = screen.getByRole('button', { name: /more actions/i })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: /import json/i }))

    await screen.findByRole('dialog', { name: /import draft json/i })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('restores focus to More actions after a menu-launched alert dialog closes', async () => {
    const user = userEvent.setup()
    render(<App />)

    const trigger = screen.getByRole('button', { name: /more actions/i })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: /reset starter/i }))

    await screen.findByRole('alertdialog', { name: /reset starter/i })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('applies pasted custom theme JSON from the settings modal', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    expect(
      within(dialog).getByRole('button', { name: /^close$/i }),
    ).toHaveFocus()
    await user.click(within(dialog).getByText(/advanced theme json/i))
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

  it('resets settings and clears custom theme JSON state', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    await user.click(within(dialog).getByText(/advanced theme json/i))
    const themeJson = within(dialog).getByLabelText('Theme JSON')
    fireEvent.change(themeJson, {
      target: {
        value: JSON.stringify({
          version: 1,
          name: 'Reset Me',
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
      await screen.findByText(/Applied custom theme.*Reset Me/i),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: /reset settings/i }),
    )
    const confirm = await screen.findByRole('alertdialog', {
      name: /reset settings/i,
    })
    await user.click(
      within(confirm).getByRole('button', { name: /^reset settings$/i }),
    )

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(settingsStorageKey) ?? '{}',
      ) as Record<string, unknown>
      expect(stored.themePreference).toBe('system')
      expect(stored.selectedThemeId).toBe('normal-light')
      expect(stored.customTheme).toBeUndefined()
    })
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resets default settings without confirmation when the JSON draft is unchanged', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    await user.click(
      within(dialog).getByRole('button', { name: /reset settings/i }),
    )

    expect(
      screen.queryByRole('alertdialog', { name: /reset settings/i }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(/Settings reset to defaults/i),
    ).toBeInTheDocument()
  })

  it('confirms reset settings when theme JSON is invalid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    await user.click(within(dialog).getByText(/advanced theme json/i))
    fireEvent.change(within(dialog).getByLabelText('Theme JSON'), {
      target: { value: '{' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: /apply json/i }),
    )

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: /reset settings/i }),
    )

    expect(
      await screen.findByRole('alertdialog', { name: /reset settings/i }),
    ).toBeInTheDocument()
  })

  it('searches and filters indexed style presets in settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^settings$/i }))

    const dialog = await screen.findByRole('dialog', { name: /settings/i })
    expect(within(dialog).getByText(/Rosé Pine Dawn/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Rosé Pine Moon/i)).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('radio', {
        name: /show rosé pine presets/i,
      }),
    )
    expect(within(dialog).getByText(/Rosé Pine Dawn/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Rosé Pine Moon/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Gmail Clean/i)).not.toBeInTheDocument()

    const search = within(dialog).getByRole('searchbox', {
      name: /search style presets/i,
    })
    await user.type(search, 'moon')

    expect(within(dialog).getByText(/Rosé Pine Moon/i)).toBeInTheDocument()
    expect(
      within(dialog).queryByText(/Rosé Pine Dawn/i),
    ).not.toBeInTheDocument()
  })

  it('associates form dialog descriptions with dialog content', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /save current/i }))

    const dialog = await screen.findByRole('dialog', {
      name: /save template/i,
    })
    const description = within(dialog).getByText(
      /Save the current local draft as a reusable template/i,
    )

    expect(description).toHaveAttribute('id')
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(description.id),
    )
  })

  it('keeps async form submissions single-flight while pending', async () => {
    const user = userEvent.setup()
    const librarySave = createDeferred<ReturnType<typeof jsonResponse>>()

    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const path = getRequestPath(input)
        const method = init?.method ?? 'GET'

        if (path === '/api/library' && method === 'PUT') {
          return librarySave.promise
        }

        if (path === '/api/library') {
          return Promise.resolve(jsonResponse(emptyLibraryBundle()))
        }

        return Promise.resolve(
          jsonResponse({
            connected: false,
            needsConfig: true,
            scopes: [],
          }),
        )
      },
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /save current/i }))

    const dialog = await screen.findByRole('dialog', {
      name: /save template/i,
    })
    const nameInput = within(dialog).getByLabelText(/template name/i)
    fireEvent.change(nameInput, { target: { value: 'Weekly update' } })

    const submit = within(dialog).getByRole('button', {
      name: /save template/i,
    })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: /working/i }),
      ).toBeDisabled(),
    )
    expect(nameInput).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: /cancel/i }),
    ).toBeDisabled()
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([path, init]) =>
            path === '/api/library' &&
            (init as RequestInit | undefined)?.method === 'PUT',
        ),
      ).toHaveLength(1),
    )

    librarySave.resolve(jsonResponse(emptyLibraryBundle()))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /save template/i }),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps async confirm actions single-flight while pending', async () => {
    const user = userEvent.setup()
    const overwrite = createDeferred<ReturnType<typeof jsonResponse>>()
    const linkedDraft = createDraft({
      gmail: {
        accountEmail: 'person@example.com',
        draftId: 'draft_1',
        lastSyncedFingerprint: 'local',
        status: 'paused',
        updatedAt: '2026-06-16T12:00:00.000Z',
      },
      html: '<p>Local draft</p>',
      subject: 'Local subject',
      text: 'Local draft',
    })
    const remoteDraft = createDraft({
      html: '<p>Remote draft</p>',
      subject: 'Remote subject',
      text: 'Remote draft',
    })
    let gmailUpdates = 0

    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const path = getRequestPath(input)
        const method = init?.method ?? 'GET'

        if (path === '/api/gmail/status') {
          return Promise.resolve(
            jsonResponse({
              connected: true,
              email: 'person@example.com',
              scopes: [],
            }),
          )
        }

        if (path === '/api/library') {
          return Promise.resolve(jsonResponse(emptyLibraryBundle()))
        }

        if (path === '/api/gmail/drafts/draft_1' && method === 'PUT') {
          gmailUpdates += 1

          if (gmailUpdates === 1) {
            return Promise.resolve(
              jsonResponse(
                {
                  error: 'Conflict',
                  remoteDraft,
                  remoteFingerprint: 'remote',
                },
                409,
              ),
            )
          }

          return overwrite.promise
        }

        return Promise.resolve(jsonResponse({}))
      },
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /more actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /import json/i }))

    const importDialog = await screen.findByRole('dialog', {
      name: /import draft json/i,
    })
    fireEvent.change(within(importDialog).getByLabelText(/draft json/i), {
      target: { value: JSON.stringify(linkedDraft) },
    })
    await user.click(
      within(importDialog).getByRole('button', { name: /import draft/i }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /import draft json/i }),
      ).not.toBeInTheDocument(),
    )
    const workflow = await screen.findByRole('region', {
      name: /draft workflow/i,
    })
    await user.click(
      within(workflow).getByRole('button', {
        name: /open gmail sync menu/i,
      }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: /sync linked draft/i }),
    )

    expect(await screen.findByText(/Draft conflict/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /overwrite gmail/i }))

    const confirm = await screen.findByRole('alertdialog', {
      name: /overwrite gmail/i,
    })
    const confirmButton = within(confirm).getByRole('button', {
      name: /overwrite gmail/i,
    })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(
        within(confirm).getByRole('button', { name: /working/i }),
      ).toBeDisabled(),
    )
    expect(
      within(confirm).getByRole('button', { name: /cancel/i }),
    ).toBeDisabled()
    expect(gmailUpdates).toBe(2)

    overwrite.resolve(
      jsonResponse({
        draft: createDraft({
          gmail: {
            accountEmail: 'person@example.com',
            draftId: 'draft_1',
            lastSyncedFingerprint: 'synced',
            status: 'synced',
            updatedAt: '2026-06-16T12:01:00.000Z',
          },
          html: '<p>Local draft</p>',
          subject: 'Local subject',
          text: 'Local draft',
        }),
        fingerprint: 'synced',
      }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: /overwrite gmail/i }),
      ).not.toBeInTheDocument(),
    )
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

function setMatchMedia(matches: boolean | ((query: string) => boolean)) {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn((query: string) => {
      const isMatch = typeof matches === 'function' ? matches(query) : matches

      return {
        matches: isMatch,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
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

function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

function emptyLibraryBundle() {
  return {
    version: 1,
    signatures: [],
    templates: [],
    variableSets: [],
  }
}

function createDraft(
  patch: Partial<{
    gmail: {
      accountEmail: string
      draftId: string
      lastSyncedFingerprint: string
      status:
        | 'conflict'
        | 'error'
        | 'paused'
        | 'pending'
        | 'synced'
        | 'unlinked'
      updatedAt: string
    }
    html: string
    subject: string
    text: string
  }> = {},
) {
  const html = patch.html ?? '<p>Hello Gmail</p>'

  return {
    version: 2,
    subject: patch.subject ?? '',
    recipients: { bcc: '', cc: '', to: '' },
    html,
    text: patch.text ?? 'Hello Gmail',
    sourceHtml: html,
    gmail: patch.gmail,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}
