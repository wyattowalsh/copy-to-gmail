import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import '@react-email/editor/themes/default.css'
import {
  copyRichHtmlToClipboard,
  sanitizeEmailBodyHtml,
  stripHtml,
} from './lib/clipboard'
import { analyzeEmailBody } from './lib/emailSafety'
import {
  analyzeGmailReadiness,
  getClipboardCapabilities,
  type GmailReadinessReport,
} from './lib/readiness'
import {
  createThemeStyle,
  parseThemeJson,
  resolveTheme,
  serializeTheme,
  THEME_PRESETS,
  type ThemeDefinition,
  type ThemePreference,
} from './lib/themes'
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
  type EditorMode,
} from './lib/settings'
import './App.css'

type CopyState = 'idle' | 'copying' | 'copied' | 'error'
type MessageTone = 'neutral' | 'success' | 'warning' | 'error'
type PreviewMode = 'rendered' | 'plain' | 'source'

type EmailExport = {
  html: string
  text: string
}

const starterContent = `
  <h1>Product update</h1>
  <p>Write your email here. Select text for formatting or type "/" for blocks.</p>
  <p>Add links, buttons, or sections when your Gmail draft needs them.</p>
`

function App() {
  const editorRef = useRef<EmailEditorRef>(null)
  const copyTimerRef = useRef<number | undefined>(undefined)
  const latestEmailRef = useRef<EmailExport | null>(null)
  const exportRequestRef = useRef(0)
  const previewCloseRef = useRef<HTMLButtonElement>(null)
  const previewOpenerRef = useRef<HTMLElement | null>(null)
  const previewPanelRef = useRef<HTMLDivElement>(null)
  const settingsCloseRef = useRef<HTMLButtonElement>(null)
  const settingsOpenerRef = useRef<HTMLElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const appContentRef = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [editorMode, setEditorMode] = useState<EditorMode>(settings.editorMode)
  const [editorKey, setEditorKey] = useState(0)
  const [editorContent, setEditorContent] = useState(starterContent)
  const [sourceHtml, setSourceHtml] = useState(starterContent.trim())
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [messageTone, setMessageTone] = useState<MessageTone>('neutral')
  const [message, setMessage] = useState('')
  const [latestEmail, setLatestEmail] = useState<EmailExport | null>(null)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('rendered')
  const [themeJsonDraft, setThemeJsonDraft] = useState('')
  const [themeJsonError, setThemeJsonError] = useState('')
  const [prefersDark, setPrefersDark] = useState(() =>
    getSystemDarkPreference(),
  )

  const activeTheme = resolveTheme(
    settings.themePreference,
    settings.selectedThemeId,
    settings.customTheme,
    prefersDark,
  )
  const activeEmail =
    editorMode === 'source' ? buildSourceEmail(sourceHtml) : latestEmail
  const capabilities = getClipboardCapabilities()
  const readinessHtml = editorMode === 'source' ? sourceHtml : activeEmail?.html
  const readiness = analyzeGmailReadiness({
    html: readinessHtml,
    text: activeEmail?.text,
    ...capabilities,
  })
  const pasteableHtml = activeEmail?.html
    ? sanitizeEmailBodyHtml(activeEmail.html)
    : ''
  const pasteableText = activeEmail?.text?.trim() || stripHtml(pasteableHtml)
  const sourceAnalysis = analyzeEmailBody(sourceHtml)
  const draftMetrics = {
    chars: pasteableText.length,
    links: readiness.linkCount,
    warnings: readiness.checks.filter((check) => check.state !== 'pass').length,
    words: pasteableText ? pasteableText.split(/\s+/).length : 0,
  }

  useEffect(() => {
    labelEditorSurface()

    return () => {
      clearStatusTimer(copyTimerRef)
    }
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')

    if (!media) {
      return
    }

    const updatePreference = () => setPrefersDark(media.matches)
    updatePreference()
    media.addEventListener('change', updatePreference)

    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (isSettingsOpen) {
      settingsCloseRef.current?.focus()
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (isPreviewOpen) {
      previewCloseRef.current?.focus()
    }
  }, [isPreviewOpen])

  useEffect(() => {
    if (!isPreviewOpen && !isSettingsOpen) {
      return
    }

    const handleLayerKeydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Tab') {
        const activePanel = isSettingsOpen
          ? settingsPanelRef.current
          : previewPanelRef.current
        trapFocusInPanel(event, activePanel)
        return
      }

      if (event.key !== 'Escape') return

      if (isSettingsOpen) {
        setSettingsOpen(false)
        restoreFocus(settingsOpenerRef)
        return
      }

      setPreviewOpen(false)
      restoreFocus(previewOpenerRef)
    }

    document.addEventListener('keydown', handleLayerKeydown)

    return () => document.removeEventListener('keydown', handleLayerKeydown)
  }, [isPreviewOpen, isSettingsOpen])

  useEffect(() => {
    const appContent = appContentRef.current
    const previousOverflow = document.body.style.overflow
    const isLayerOpen = isPreviewOpen || isSettingsOpen

    if (isLayerOpen) {
      document.body.style.overflow = 'hidden'
      appContent?.setAttribute('aria-hidden', 'true')
      if (appContent) appContent.inert = true
    } else {
      appContent?.removeAttribute('aria-hidden')
      if (appContent) appContent.inert = false
    }

    return () => {
      document.body.style.overflow = previousOverflow
      appContent?.removeAttribute('aria-hidden')
      if (appContent) appContent.inert = false
    }
  }, [isPreviewOpen, isSettingsOpen])

  async function handleCopyForGmail() {
    await runCopyAction(async () => {
      const email = await requireCurrentEmail()
      await copyRichHtmlToClipboard(email)
      setStatus(
        'Copied rich email: HTML and plain text are ready for Gmail.',
        'success',
      )
    })
  }

  async function handleCopyPlainText() {
    await runCopyAction(async () => {
      const email = await requireCurrentEmail()
      await writeClipboardText(
        email.text || stripHtml(sanitizeEmailBodyHtml(email.html)),
      )
      setStatus('Copied the plain-text fallback.', 'success')
    })
  }

  async function handleCopySanitizedHtml() {
    await runCopyAction(async () => {
      const email = await requireCurrentEmail()
      await writeClipboardText(sanitizeEmailBodyHtml(email.html))
      setStatus('Copied sanitized body HTML for debugging.', 'success')
    })
  }

  async function handleCopyThemeJson() {
    await runCopyAction(async () => {
      await writeClipboardText(serializeTheme(activeTheme))
      setStatus('Copied current theme JSON.', 'success')
    })
  }

  async function handleExportDraftJson() {
    await runCopyAction(async () => {
      const email = await requireCurrentEmail()
      await writeClipboardText(
        JSON.stringify(
          {
            version: 1,
            html: sanitizeEmailBodyHtml(email.html),
            text: email.text || stripHtml(sanitizeEmailBodyHtml(email.html)),
            sourceHtml,
            settings,
          },
          null,
          2,
        ),
      )
      setStatus('Copied draft JSON for local backup or handoff.', 'success')
    })
  }

  async function handlePreviewBody() {
    try {
      await requireCurrentEmail()
      previewOpenerRef.current = getActiveHTMLElement()
      setPreviewOpen(true)
      setStatus('Previewing the sanitized Gmail body.', 'neutral')
    } catch (error) {
      setCopyState('error')
      setStatus(getCopyErrorMessage(error), 'error')
    }
  }

  async function switchToSourceMode() {
    try {
      const email = await requireCurrentEmail()
      const html = sanitizeEmailBodyHtml(email.html)
      setSourceHtml(html)
      setEditorMode('source')
      updateSettings({ editorMode: 'source' })
      setStatus(
        'Source mode is ready. Edits stay in code until you apply them.',
        'neutral',
      )
    } catch (error) {
      setStatus(getCopyErrorMessage(error), 'error')
    }
  }

  function switchToVisualMode() {
    setEditorMode('visual')
    updateSettings({ editorMode: 'visual' })
    setStatus('Visual mode is active.', 'neutral')
  }

  function applySourceToVisual() {
    const html = sanitizeEmailBodyHtml(sourceHtml)

    if (!html) {
      setStatus(
        'Add source HTML before applying it to the visual editor.',
        'warning',
      )
      return
    }

    const email = { html, text: stripHtml(html) }
    latestEmailRef.current = email
    setLatestEmail(email)
    setEditorContent(html)
    setEditorKey((key) => key + 1)
    setEditorMode('visual')
    updateSettings({ editorMode: 'visual' })
    setStatus('Applied sanitized source HTML to the visual editor.', 'success')
  }

  async function handleValidateNow() {
    if (editorMode === 'visual') {
      await refreshEmailCache()
    }

    setStatus('Gmail readiness checks refreshed.', 'neutral')
  }

  async function handleClearFormatting() {
    const email = await requireCurrentEmail()
    const plainText = email.text || stripHtml(sanitizeEmailBodyHtml(email.html))
    const html = plainTextToParagraphs(plainText)
    setSourceHtml(html)
    setEditorContent(html)
    latestEmailRef.current = { html, text: plainText }
    setLatestEmail({ html, text: plainText })

    if (editorMode === 'visual') {
      setEditorKey((key) => key + 1)
    }

    setStatus('Cleared rich formatting into simple paragraphs.', 'success')
  }

  function handleResetStarter() {
    const hasDraft = Boolean(activeEmail?.html || sourceHtml.trim())

    if (
      hasDraft &&
      !window.confirm('Reset the current draft to the starter email?')
    ) {
      return
    }

    const email = buildSourceEmail(starterContent)
    setSourceHtml(starterContent.trim())
    setEditorContent(starterContent)
    setEditorKey((key) => key + 1)
    latestEmailRef.current = email
    setLatestEmail(email)
    setStatus('Starter draft restored.', 'success')
  }

  function handleImportDraftJson() {
    const raw = window.prompt('Paste draft JSON exported from Copy to Gmail:')

    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as unknown

      if (!isDraftImport(parsed)) {
        throw new Error('Draft JSON must include an html string.')
      }

      const html = sanitizeEmailBodyHtml(parsed.html)
      const email = { html, text: parsed.text?.trim() || stripHtml(html) }
      setSourceHtml(parsed.sourceHtml?.trim() || html)
      setEditorContent(html)
      setEditorKey((key) => key + 1)
      latestEmailRef.current = email
      setLatestEmail(email)
      setStatus('Imported draft JSON into the local composer.', 'success')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Unable to import draft JSON.',
        'error',
      )
    }
  }

  function openSettings() {
    settingsOpenerRef.current = getActiveHTMLElement()
    setThemeJsonDraft(serializeTheme(activeTheme))
    setThemeJsonError('')
    setSettingsOpen(true)
  }

  function closePreview() {
    setPreviewOpen(false)
    restoreFocus(previewOpenerRef)
  }

  function closeSettings() {
    setSettingsOpen(false)
    restoreFocus(settingsOpenerRef)
  }

  function handleApplyThemeJson() {
    const result = parseThemeJson(themeJsonDraft)

    if (!result.ok) {
      setThemeJsonError(result.error)
      return
    }

    updateSettings({
      customTheme: result.theme,
      selectedThemeId: result.theme.id,
      themePreference: 'custom',
    })
    setThemeJsonError('')
    setStatus(`Applied custom theme “${result.theme.name}”.`, 'success')
  }

  function handleThemePreference(preference: ThemePreference) {
    const selectedThemeId =
      preference === 'light'
        ? 'normal-light'
        : preference === 'dark'
          ? 'normal-dark'
          : settings.selectedThemeId
    updateSettings({ themePreference: preference, selectedThemeId })

    if (preference !== 'custom') {
      setStatus(`Theme set to ${preference}.`, 'neutral')
    } else if (!settings.customTheme) {
      openSettings()
    }
  }

  function handleThemePreset(theme: ThemeDefinition) {
    updateSettings({
      selectedThemeId: theme.id,
      themePreference: theme.mode,
    })
    setStatus(`Applied ${theme.name}.`, 'success')
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  async function runCopyAction(action: () => Promise<void>) {
    clearStatusTimer(copyTimerRef)
    setCopyState('copying')
    setMessage('')

    try {
      await action()
      setCopyState('copied')
      copyTimerRef.current = window.setTimeout(() => {
        setCopyState('idle')
        setStatus('', 'neutral')
      }, 2600)
    } catch (error) {
      setCopyState('error')
      setStatus(getCopyErrorMessage(error), 'error')
    }
  }

  function setStatus(value: string, tone: MessageTone) {
    setMessage(value)
    setMessageTone(tone)
  }

  function handleEditorReady(ref: EmailEditorRef) {
    editorRef.current = ref
    labelEditorSurface()
    void refreshEmailCache(ref)
  }

  function handleEditorUpdate(ref: EmailEditorRef) {
    editorRef.current = ref
    labelEditorSurface()
    void refreshEmailCache(ref)
  }

  async function refreshEmailCache(ref = editorRef.current) {
    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const email = await ref?.getEmail()

    if (requestId === exportRequestRef.current && email?.html) {
      latestEmailRef.current = email
      setLatestEmail(email)
    }
  }

  async function getCurrentEmail(): Promise<EmailExport | null> {
    if (editorMode === 'source') {
      return buildSourceEmail(sourceHtml)
    }

    const email = await editorRef.current?.getEmail()

    if (email?.html) {
      latestEmailRef.current = email
      setLatestEmail(email)
      return email
    }

    return latestEmailRef.current
  }

  async function requireCurrentEmail(): Promise<EmailExport> {
    const email = await getCurrentEmail()

    if (!email?.html) {
      throw new Error('The editor is not ready yet. Try again in a moment.')
    }

    return email
  }

  const copyLabel = {
    idle: 'Copy for Gmail',
    copying: 'Copying...',
    copied: 'Copied rich email',
    error: 'Try Copy Again',
  }[copyState]

  const themeStyle = createThemeStyle(activeTheme) as CSSProperties

  return (
    <main
      className="app-shell"
      data-density={activeTheme.tokens.density}
      data-theme-mode={activeTheme.mode}
      style={themeStyle}
    >
      <div ref={appContentRef} className="app-content">
        <header className="app-chrome floating-chrome">
          <div className="brand-block">
            <span className="app-mark" aria-hidden="true">
              C2G
            </span>
            <div>
              <h1>Copy to Gmail</h1>
            </div>
          </div>
          <div className="chrome-actions">
            <ThemeSwitcher
              preference={settings.themePreference}
              onPreference={handleThemePreference}
            />
            <span className="theme-summary">{activeTheme.name}</span>
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={openSettings}
            >
              Settings
            </button>
          </div>
        </header>

        <div className="studio-grid floating-studio">
          <section
            className="composer editor-workbench"
            aria-labelledby="editor-heading"
          >
            <div className="editor-frame">
              <aside className="editor-rail" aria-label="Editor tools">
                <div className="rail-section">
                  <span className="field-label">Mode</span>
                  <div
                    className="mode-switcher mode-switcher-rail"
                    role="group"
                    aria-label="Editor mode"
                  >
                    <button
                      type="button"
                      aria-pressed={editorMode === 'visual'}
                      onClick={() => switchToVisualMode()}
                    >
                      Visual
                    </button>
                    <button
                      type="button"
                      aria-pressed={editorMode === 'source'}
                      onClick={() => void switchToSourceMode()}
                    >
                      Source
                    </button>
                  </div>
                </div>
                <div className="rail-stat">
                  <strong>{readiness.status}</strong>
                </div>
              </aside>

              <div className="editor-main">
                <div className="composer-topbar floating-editor-header">
                  <div>
                    <span className="field-label">Draft</span>
                    <h2 id="editor-heading" className="field-value">
                      Untitled Gmail body
                    </h2>
                  </div>
                  <output
                    className={`status status-${messageTone}`}
                    aria-atomic="true"
                    aria-live={messageTone === 'error' ? 'assertive' : 'polite'}
                    role={messageTone === 'error' ? 'alert' : 'status'}
                  >
                    {message}
                  </output>
                </div>
                <ReadinessCompact report={readiness} />
                <div
                  className="editor-action-bar floating-toolbelt"
                  role="group"
                  aria-label="Composer tools"
                >
                  <div className="action-group action-group-primary tool-cluster">
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => void handleCopyForGmail()}
                      disabled={copyState === 'copying'}
                    >
                      {copyLabel}
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      aria-label="Open preview drawer"
                      onClick={() => void handlePreviewBody()}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => void handleValidateNow()}
                    >
                      Validate
                    </button>
                  </div>
                  <details className="tool-menu tool-menu-more">
                    <summary>More actions</summary>
                    <div className="tool-menu-panel">
                      <span className="tool-menu-label">Copy variants</span>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void handleCopyPlainText()}
                      >
                        Plain text
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void handleCopySanitizedHtml()}
                      >
                        Sanitized HTML
                      </button>
                      <span className="tool-menu-label">Draft tools</span>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void handleExportDraftJson()}
                      >
                        Export JSON
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={handleImportDraftJson}
                      >
                        Import JSON
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void handleClearFormatting()}
                      >
                        Clear formatting
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={handleResetStarter}
                      >
                        Reset starter
                      </button>
                    </div>
                  </details>
                </div>
                <p id="editor-help" className="sr-only">
                  Compose the email body. Select text for formatting, type slash
                  for blocks, or switch to Source mode to paste HTML.
                </p>
                <div className="editor-stage">
                  {editorMode === 'visual' ? (
                    <EmailEditor
                      key={editorKey}
                      ref={editorRef}
                      content={editorContent}
                      className="email-editor"
                      placeholder="Press '/' for blocks"
                      onReady={handleEditorReady}
                      onUpdate={handleEditorUpdate}
                    />
                  ) : (
                    <div className="source-editor-shell">
                      <div className="source-editor-header">
                        <div>
                          <span className="field-label">Code input</span>
                          <strong>Paste or edit body HTML</strong>
                        </div>
                        <button
                          type="button"
                          className="secondary-action compact-action"
                          onClick={applySourceToVisual}
                        >
                          Apply to visual editor
                        </button>
                      </div>
                      <label className="sr-only" htmlFor="source-html">
                        Source HTML
                      </label>
                      <textarea
                        id="source-html"
                        className="source-editor"
                        spellCheck={false}
                        value={sourceHtml}
                        onChange={(event) => setSourceHtml(event.target.value)}
                      />
                      <div className="source-diagnostics" aria-live="polite">
                        <span>
                          {sourceAnalysis.unsupportedElements.length} blocked
                          elements
                        </span>
                        <span>
                          {sourceAnalysis.unsafeLinks.length} unsafe links
                        </span>
                        <span>
                          {sourceAnalysis.text.length} plain-text chars
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside
            className="side-panel floating-inspector"
            aria-label="Gmail readiness and preview tools"
          >
            <ReadinessPanel report={readiness} />

            <section className="panel-card metrics-card">
              <div className="panel-card-header">
                <span className="field-label">Draft metrics</span>
                <strong>{draftMetrics.words} words</strong>
              </div>
              <dl className="metrics-list">
                <div>
                  <dt>Characters</dt>
                  <dd>{draftMetrics.chars}</dd>
                </div>
                <div>
                  <dt>Links</dt>
                  <dd>{draftMetrics.links}</dd>
                </div>
                <div>
                  <dt>Warnings</dt>
                  <dd>{draftMetrics.warnings}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>

      {isPreviewOpen ? (
        <PreviewDrawer
          html={pasteableHtml}
          mode={previewMode}
          panelRef={previewPanelRef}
          readiness={readiness}
          sourceHtml={pasteableHtml}
          text={pasteableText}
          closeButtonRef={previewCloseRef}
          onClose={closePreview}
          onMode={setPreviewMode}
        />
      ) : null}

      {isSettingsOpen ? (
        <SettingsModal
          activeTheme={activeTheme}
          closeButtonRef={settingsCloseRef}
          panelRef={settingsPanelRef}
          settings={settings}
          themeJsonDraft={themeJsonDraft}
          themeJsonError={themeJsonError}
          onApplyThemeJson={handleApplyThemeJson}
          onClose={closeSettings}
          onCopyThemeJson={() => void handleCopyThemeJson()}
          onPresetTheme={handleThemePreset}
          onSettings={updateSettings}
          onThemeJsonDraft={setThemeJsonDraft}
          onThemePreference={handleThemePreference}
        />
      ) : null}
    </main>
  )
}

function ThemeSwitcher({
  preference,
  onPreference,
}: {
  preference: ThemePreference
  onPreference: (preference: ThemePreference) => void
}) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme preference">
      {(['light', 'dark', 'system'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={preference === mode}
          onClick={() => onPreference(mode)}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

function ReadinessCompact({ report }: { report: GmailReadinessReport }) {
  const warningCount = report.checks.filter(
    (check) => check.state !== 'pass',
  ).length

  return (
    <section className="readiness-strip" aria-label="Copy readiness summary">
      <div>
        <span className="field-label">Readiness</span>
        <strong>{report.status}</strong>
      </div>
      <span
        className={`readiness-pill readiness-${report.status.toLowerCase().replace(' ', '-')}`}
      >
        {warningCount
          ? `${warningCount} issue${warningCount === 1 ? '' : 's'}`
          : 'Ready to copy'}
      </span>
    </section>
  )
}

function ReadinessPanel({ report }: { report: GmailReadinessReport }) {
  return (
    <section
      className="panel-card readiness-card"
      aria-labelledby="readiness-heading"
    >
      <div className="readiness-summary">
        <div>
          <span className="field-label">Gmail readiness</span>
          <h2 id="readiness-heading">{report.status}</h2>
        </div>
        <span
          className={`readiness-pill readiness-${report.status.toLowerCase().replace(' ', '-')}`}
        >
          {report.status}
        </span>
      </div>
      <ul className="readiness-list">
        {report.checks.map((check) => (
          <li
            key={check.id}
            className={`readiness-check readiness-check-${check.state}`}
          >
            <span aria-hidden="true" />
            <div>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PreviewDrawer({
  closeButtonRef,
  html,
  mode,
  panelRef,
  readiness,
  sourceHtml,
  text,
  onClose,
  onMode,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>
  html: string
  mode: PreviewMode
  panelRef: RefObject<HTMLDivElement | null>
  readiness: GmailReadinessReport
  sourceHtml: string
  text: string
  onClose: () => void
  onMode: (mode: PreviewMode) => void
}) {
  return (
    <section className="preview-drawer" aria-label="Gmail body preview">
      <button
        type="button"
        className="preview-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-heading"
        tabIndex={-1}
      >
        <div className="preview-header">
          <div>
            <span className="eyebrow">Sanitized preview</span>
            <h2 id="preview-heading">Gmail body preview</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="preview-tabs" role="group" aria-label="Preview mode">
          {(['rendered', 'plain', 'source'] as const).map((previewMode) => (
            <button
              key={previewMode}
              type="button"
              aria-pressed={mode === previewMode}
              className={mode === previewMode ? 'active' : ''}
              onClick={() => onMode(previewMode)}
            >
              {previewMode === 'rendered'
                ? 'Rendered'
                : previewMode === 'plain'
                  ? 'Plain text'
                  : 'Source'}
            </button>
          ))}
        </div>
        <div className="preview-meta">
          <span>
            {readiness.linkCount} link{readiness.linkCount === 1 ? '' : 's'}
          </span>
          <span>{text.length} plain-text chars</span>
        </div>
        {mode === 'rendered' ? (
          <article
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="preview-content preview-text">
            {mode === 'plain' ? text : sanitizeEmailBodyHtml(sourceHtml)}
          </pre>
        )}
      </div>
    </section>
  )
}

function SettingsModal({
  activeTheme,
  closeButtonRef,
  panelRef,
  settings,
  themeJsonDraft,
  themeJsonError,
  onApplyThemeJson,
  onClose,
  onCopyThemeJson,
  onPresetTheme,
  onSettings,
  onThemeJsonDraft,
  onThemePreference,
}: {
  activeTheme: ThemeDefinition
  closeButtonRef: RefObject<HTMLButtonElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  settings: AppSettings
  themeJsonDraft: string
  themeJsonError: string
  onApplyThemeJson: () => void
  onClose: () => void
  onCopyThemeJson: () => void
  onPresetTheme: (theme: ThemeDefinition) => void
  onSettings: (patch: Partial<AppSettings>) => void
  onThemeJsonDraft: (value: string) => void
  onThemePreference: (preference: ThemePreference) => void
}) {
  return (
    <section className="settings-layer" aria-label="Settings">
      <button
        type="button"
        className="preview-backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        tabIndex={-1}
      >
        <div className="preview-header">
          <div>
            <span className="eyebrow">Studio controls</span>
            <h2 id="settings-heading">Settings</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="settings-grid">
          <section className="settings-section">
            <h3>Appearance</h3>
            <p>
              Theme changes stay local. Pick a bundled preset here, or use the
              advanced JSON editor below when you need custom tokens.
            </p>
            <div className="active-theme-summary">
              <span
                style={{
                  background: activeTheme.tokens.background,
                  borderColor: activeTheme.tokens.lineStrong,
                  color: activeTheme.tokens.accent,
                }}
              >
                Aa
              </span>
              <div>
                <strong>{activeTheme.name}</strong>
                <small>{activeTheme.mode} mode active</small>
              </div>
            </div>
            <div
              className="theme-mode-grid"
              role="group"
              aria-label="Theme preference"
            >
              {(['light', 'dark', 'system', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={settings.themePreference === mode}
                  onClick={() => onThemePreference(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="settings-subhead">Light presets</span>
            <div className="theme-preset-grid">
              {THEME_PRESETS.filter((theme) => theme.mode === 'light').map(
                (theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className="theme-card"
                    aria-pressed={activeTheme.id === theme.id}
                    onClick={() => onPresetTheme(theme)}
                  >
                    <span
                      style={{
                        background: theme.tokens.background,
                        borderColor: theme.tokens.lineStrong,
                        color: theme.tokens.accent,
                      }}
                    >
                      Aa
                    </span>
                    {theme.name}
                  </button>
                ),
              )}
            </div>
            <span className="settings-subhead">Dark presets</span>
            <div className="theme-preset-grid">
              {THEME_PRESETS.filter((theme) => theme.mode === 'dark').map(
                (theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className="theme-card"
                    aria-pressed={activeTheme.id === theme.id}
                    onClick={() => onPresetTheme(theme)}
                  >
                    <span
                      style={{
                        background: theme.tokens.background,
                        borderColor: theme.tokens.lineStrong,
                        color: theme.tokens.accent,
                      }}
                    >
                      Aa
                    </span>
                    {theme.name}
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="settings-section settings-section-advanced">
            <h3>Advanced Theme JSON</h3>
            <p>
              Copy, paste, validate, and apply a local theme token object. This
              is intentionally tucked away from the main composing flow.
            </p>
            <label className="sr-only" htmlFor="theme-json">
              Theme JSON
            </label>
            <textarea
              id="theme-json"
              className="theme-json-input"
              spellCheck={false}
              value={themeJsonDraft}
              onChange={(event) => onThemeJsonDraft(event.target.value)}
            />
            {themeJsonError ? (
              <p className="settings-error" role="alert">
                {themeJsonError}
              </p>
            ) : null}
            <div className="settings-actions">
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={onApplyThemeJson}
              >
                Apply JSON
              </button>
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={onCopyThemeJson}
              >
                Copy current JSON
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Editor and privacy</h3>
            <label className="toggle-row">
              <span>Open in Source mode by default</span>
              <input
                type="checkbox"
                checked={settings.editorMode === 'source'}
                onChange={(event) =>
                  onSettings({
                    editorMode: event.target.checked ? 'source' : 'visual',
                  })
                }
              />
            </label>
            <label className="toggle-row">
              <span>Show clipboard privacy reminders</span>
              <input
                type="checkbox"
                checked={settings.clipboardPrivacyReminder}
                onChange={(event) =>
                  onSettings({ clipboardPrivacyReminder: event.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>Opt in to local draft recovery</span>
              <input
                type="checkbox"
                checked={settings.draftRecovery}
                onChange={(event) =>
                  onSettings({ draftRecovery: event.target.checked })
                }
              />
            </label>
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={() => onSettings(defaultSettings)}
            >
              Reset settings
            </button>
          </section>
        </div>
      </div>
    </section>
  )
}

function getActiveHTMLElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
}

function restoreFocus(ref: RefObject<HTMLElement | null>) {
  const target = ref.current
  ref.current = null

  if (!target?.isConnected) {
    return
  }

  window.requestAnimationFrame(() => target.focus())
}

function trapFocusInPanel(
  event: globalThis.KeyboardEvent,
  panel: HTMLElement | null,
) {
  if (!panel) {
    return
  }

  const focusableElements = getFocusableElements(panel)

  if (!focusableElements.length) {
    event.preventDefault()
    panel.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true',
  )
}

function buildSourceEmail(html: string): EmailExport {
  const sanitizedHtml = sanitizeEmailBodyHtml(html)
  return { html: sanitizedHtml, text: stripHtml(sanitizedHtml) }
}

function labelEditorSurface() {
  const editor = document.querySelector<HTMLElement>('.email-editor .tiptap')
  editor?.setAttribute('aria-label', 'Email body editor')
  editor?.setAttribute('aria-describedby', 'editor-help')
}

function clearStatusTimer(ref: { current: number | undefined }) {
  if (ref.current) {
    window.clearTimeout(ref.current)
    ref.current = undefined
  }
}

async function writeClipboardText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error(
      'Plain clipboard copy is unavailable in this browser context.',
    )
  }

  await navigator.clipboard.writeText(value)
}

function getCopyErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Clipboard permission was blocked. Use the preview drawer to select and copy manually.'
  }

  return error instanceof Error ? error.message : 'Unable to copy the email.'
}

function plainTextToParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getSystemDarkPreference(): boolean {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

function isDraftImport(
  value: unknown,
): value is { html: string; sourceHtml?: string; text?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { html?: unknown }).html === 'string'
  )
}

export default App
