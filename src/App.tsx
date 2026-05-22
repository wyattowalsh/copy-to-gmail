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
import {
  draftFromEditorState,
  parseDraftImport,
  serializeDraft,
  type DraftRecipients,
  type GmailDraftLink,
  type LocalDraft,
} from './lib/drafts'
import { fingerprintDraft } from './lib/fingerprints'
import {
  GmailConflictError,
  createGmailDraft,
  disconnectGmail,
  getGmailStatus,
  importGmailSignatures,
  listGmailDrafts,
  loadGmailDraft,
  updateGmailDraft,
  type GmailAuthStatus,
  type GmailDraftSummary,
} from './lib/gmailApi'
import { buildGmailDraftUrl } from './lib/gmailLinks'
import { getAutosyncDelay } from './lib/autosync'
import {
  createEmptyLibrary,
  mergeLibraryBundles,
  parseLibraryBundle,
  serializeLibraryBundle,
  type LibraryBundle,
} from './lib/libraryBundle'
import { getLibraryBundle, saveLibraryBundle } from './lib/libraryApi'
import { appendSignatureHtml, createLocalSignature } from './lib/signatures'
import {
  applyTemplate,
  collectTemplateVariables,
  createTemplateFromDraft,
  type EmailTemplate,
  type VariableSet,
} from './lib/templates'
import './App.css'

type CopyState = 'idle' | 'copying' | 'copied' | 'error'
type MessageTone = 'neutral' | 'success' | 'warning' | 'error'
type PreviewMode = 'rendered' | 'plain' | 'source'

type EmailExport = {
  html: string
  text: string
}

type GmailConflictState = {
  localDraft: LocalDraft
  remoteDraft: LocalDraft
  remoteFingerprint: string
}

const signatureScope = 'https://www.googleapis.com/auth/gmail.settings.basic'

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
  const autosyncTimerRef = useRef<number | undefined>(undefined)
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
  const [draftSubject, setDraftSubject] = useState('')
  const [draftRecipients, setDraftRecipients] = useState<DraftRecipients>({
    bcc: '',
    cc: '',
    to: '',
  })
  const [selectedSignatureId, setSelectedSignatureId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [gmailStatus, setGmailStatus] = useState<GmailAuthStatus>({
    connected: false,
    scopes: [],
  })
  const [gmailDrafts, setGmailDrafts] = useState<GmailDraftSummary[]>([])
  const [gmailLink, setGmailLink] = useState<GmailDraftLink | undefined>()
  const [gmailConflict, setGmailConflict] = useState<GmailConflictState | null>(
    null,
  )
  const [gmailBusy, setGmailBusy] = useState(false)
  const [gmailMessage, setGmailMessage] = useState('')
  const [library, setLibrary] = useState<LibraryBundle>(() =>
    createEmptyLibrary(),
  )
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryMessage, setLibraryMessage] = useState('')
  const [selectedVariableSetId, setSelectedVariableSetId] = useState('')
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
    recipients: draftRecipients,
    subject: draftSubject,
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

  const openGmailUrl = buildGmailDraftUrl({
    accountEmail: gmailStatus.email ?? gmailLink?.accountEmail,
    draftId: gmailLink?.draftId,
  })
  const selectedTemplate = library.templates.find(
    (template) => template.id === selectedTemplateId,
  )
  const selectedSignature = library.signatures.find(
    (signature) => signature.id === selectedSignatureId,
  )
  const selectedVariableSet = library.variableSets.find(
    (variableSet) => variableSet.id === selectedVariableSetId,
  )
  const canImportGmailSignatures = gmailStatus.scopes.includes(signatureScope)

  useEffect(() => {
    labelEditorSurface()
    void refreshGmailStatus()
    void refreshLibrary()

    return () => {
      clearStatusTimer(copyTimerRef)
      clearStatusTimer(autosyncTimerRef)
    }
  }, [])

  useEffect(() => {
    if (!gmailLink?.draftId) {
      return
    }

    clearStatusTimer(autosyncTimerRef)
    void scheduleAutosync()
    // Autosync is intentionally keyed by draft fields and Gmail linkage,
    // not by helper function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftRecipients.bcc,
    draftRecipients.cc,
    draftRecipients.to,
    draftSubject,
    editorMode,
    gmailLink?.draftId,
    gmailLink?.lastSyncedFingerprint,
    gmailLink?.status,
    latestEmail?.html,
    selectedSignatureId,
    selectedTemplateId,
    sourceHtml,
  ])

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
      const draft = await requireCurrentDraft()
      await writeClipboardText(serializeDraft(draft))
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
      const draft = parseDraftImport(JSON.parse(raw) as unknown)
      const html = sanitizeEmailBodyHtml(draft.html)
      const email = { html, text: draft.text?.trim() || stripHtml(html) }
      setDraftSubject(draft.subject)
      setDraftRecipients(draft.recipients)
      setGmailLink(draft.gmail)
      setSelectedSignatureId(draft.selectedSignatureId ?? '')
      setSelectedTemplateId(draft.selectedTemplateId ?? '')
      setSourceHtml(draft.sourceHtml?.trim() || html)
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

  async function refreshLibrary() {
    try {
      setLibrary(await getLibraryBundle())
      setLibraryMessage('Template, signature, and variable library loaded.')
    } catch (error) {
      setLibraryMessage(getLibraryErrorMessage(error))
    }
  }

  async function refreshGmailStatus() {
    try {
      const status = await getGmailStatus()
      setGmailStatus(status)
      setGmailMessage(
        status.connected
          ? `Connected as ${status.email ?? 'Gmail account'}.`
          : status.needsConfig
            ? 'Add Google OAuth config to enable Gmail sync.'
            : 'Gmail sync is optional and disconnected.',
      )
    } catch (error) {
      setGmailMessage(getGmailErrorMessage(error))
    }
  }

  function handleGmailConnect() {
    window.location.assign('/api/gmail/connect')
  }

  async function handleGmailDisconnect() {
    await runGmailAction(async () => {
      const status = await disconnectGmail()
      setGmailStatus(status)
      setGmailDrafts([])
      setGmailLink(undefined)
      setGmailMessage('Disconnected Gmail. Local drafting still works.')
    })
  }

  async function handleLoadGmailDrafts() {
    await runGmailAction(async () => {
      const drafts = await listGmailDrafts()
      setGmailDrafts(drafts)
      setGmailMessage(
        drafts.length
          ? `Loaded ${drafts.length} Gmail draft${drafts.length === 1 ? '' : 's'}.`
          : 'No Gmail drafts were returned for this account.',
      )
    })
  }

  async function handleLoadGmailDraft(draftId: string) {
    await runGmailAction(async () => {
      const result = await loadGmailDraft(draftId)
      applyDraftToEditor(result.draft)
      setGmailMessage('Loaded Gmail draft into the local composer.')
    })
  }

  async function handleCreateGmailDraft() {
    await runGmailAction(async () => {
      const draft = await requireCurrentDraft('pending')
      const result = await createGmailDraft(draft)
      applySyncedGmailLink(result.draft.gmail, result.fingerprint)
      setGmailMessage('Created and linked a new Gmail draft.')
    })
  }

  async function handleUpdateGmailDraft() {
    await runGmailAction(async () => {
      if (!gmailLink?.draftId) {
        await handleCreateGmailDraft()
        return
      }

      const draft = await requireCurrentDraft('pending')
      const result = await updateGmailDraft(gmailLink.draftId, draft, {
        expectedFingerprint: gmailLink.lastSyncedFingerprint,
      })
      applySyncedGmailLink(result.draft.gmail, result.fingerprint)
      setGmailMessage('Updated the linked Gmail draft.')
    })
  }

  async function runGmailAction(action: () => Promise<void>) {
    setGmailBusy(true)

    try {
      await action()
    } catch (error) {
      if (error instanceof GmailConflictError) {
        const localDraft = await requireCurrentDraft('conflict')
        setGmailConflict({
          localDraft,
          remoteDraft: error.remoteDraft,
          remoteFingerprint: error.remoteFingerprint,
        })
        setGmailLink((current) =>
          current ? { ...current, status: 'conflict' } : current,
        )
        setGmailMessage(
          'Gmail changed this draft elsewhere. Choose how to resolve it.',
        )
        return
      }

      setGmailLink((current) =>
        current ? { ...current, status: 'error' } : current,
      )
      setGmailMessage(getGmailErrorMessage(error))
    } finally {
      setGmailBusy(false)
    }
  }

  async function scheduleAutosync() {
    if (!gmailLink?.draftId || gmailBusy) {
      return
    }

    const draft = await requireCurrentDraft('pending')
    const fingerprint = await fingerprintDraft(draft)

    if (fingerprint === gmailLink.lastSyncedFingerprint) {
      return
    }

    const delay = getAutosyncDelay({
      changed: true,
      lastSyncedAt: gmailLink.updatedAt,
      linked: true,
      status: gmailLink.status,
    })

    if (delay === null) {
      return
    }

    setGmailLink((current) =>
      current?.draftId === gmailLink.draftId
        ? { ...current, status: 'pending' }
        : current,
    )
    autosyncTimerRef.current = window.setTimeout(() => {
      void autosyncLinkedDraft(
        gmailLink.draftId,
        gmailLink.lastSyncedFingerprint,
      )
    }, delay)
  }

  async function autosyncLinkedDraft(
    draftId: string,
    expectedFingerprint: string,
  ) {
    try {
      const draft = await requireCurrentDraft('pending')
      const result = await updateGmailDraft(draftId, draft, {
        expectedFingerprint,
      })
      applySyncedGmailLink(result.draft.gmail, result.fingerprint)
      setGmailMessage('Autosynced the linked Gmail draft.')
    } catch (error) {
      if (error instanceof GmailConflictError) {
        const localDraft = await requireCurrentDraft('conflict')
        setGmailConflict({
          localDraft,
          remoteDraft: error.remoteDraft,
          remoteFingerprint: error.remoteFingerprint,
        })
        setGmailLink((current) =>
          current ? { ...current, status: 'conflict' } : current,
        )
        setGmailMessage('Autosync paused because Gmail has newer content.')
        return
      }

      setGmailLink((current) =>
        current ? { ...current, status: 'error' } : current,
      )
      setGmailMessage(getGmailErrorMessage(error))
    }
  }

  function handleReplaceLocalConflict() {
    if (!gmailConflict) {
      return
    }

    applyDraftToEditor(gmailConflict.remoteDraft)
    applySyncedGmailLink(
      gmailConflict.remoteDraft.gmail,
      gmailConflict.remoteFingerprint,
    )
    setGmailMessage('Replaced local content with the current Gmail draft.')
  }

  async function handleOverwriteGmailConflict() {
    if (!gmailConflict || !gmailLink?.draftId) {
      return
    }

    if (
      !window.confirm('Overwrite the changed Gmail draft with local edits?')
    ) {
      return
    }

    await runGmailAction(async () => {
      const result = await updateGmailDraft(
        gmailLink.draftId,
        gmailConflict.localDraft,
      )
      applySyncedGmailLink(result.draft.gmail, result.fingerprint)
      setGmailMessage('Overwrote Gmail with the local draft.')
    })
  }

  async function handleSaveNewConflictVersion() {
    if (!gmailConflict) {
      return
    }

    await runGmailAction(async () => {
      const result = await createGmailDraft(gmailConflict.localDraft)
      applySyncedGmailLink(result.draft.gmail, result.fingerprint)
      setGmailMessage('Saved local edits as a separate Gmail draft.')
    })
  }

  function handleCancelConflict() {
    setGmailConflict(null)
    setGmailLink((current) =>
      current ? { ...current, status: 'paused' } : current,
    )
    setGmailMessage('Conflict left unresolved. Local edits are still intact.')
  }

  async function persistLibrary(next: LibraryBundle, successMessage: string) {
    setLibraryBusy(true)
    setLibrary(next)

    try {
      setLibrary(await saveLibraryBundle(next))
      setLibraryMessage(successMessage)
    } catch (error) {
      setLibraryMessage(
        `${successMessage} Saved for this browser session only: ${getLibraryErrorMessage(error)}`,
      )
    } finally {
      setLibraryBusy(false)
    }
  }

  async function handleSaveTemplate() {
    const name = window.prompt('Template name:')

    if (!name) {
      return
    }

    const draft = await requireCurrentDraft('pending')
    const template = createTemplateFromDraft({
      draft,
      id: createBrowserId('tpl'),
      name,
      updatedAt: new Date().toISOString(),
    })
    const next = { ...library, templates: [...library.templates, template] }
    setSelectedTemplateId(template.id)
    await persistLibrary(next, `Saved template “${template.name}”.`)
  }

  function handleApplyTemplate() {
    if (!selectedTemplate) {
      setLibraryMessage('Choose a template before applying it.')
      return
    }

    const values = collectPlaceholderValues(
      selectedTemplate,
      selectedVariableSet?.values ?? {},
    )
    const signature = selectedTemplate.selectedSignatureId
      ? library.signatures.find(
          (candidate) => candidate.id === selectedTemplate.selectedSignatureId,
        )
      : selectedSignature
    const draft = applyTemplate(selectedTemplate, values, signature?.html ?? '')
    applyDraftToEditor({
      ...draft,
      gmail: gmailLink ? { ...gmailLink, status: 'pending' } : undefined,
    })
    setSelectedTemplateId(selectedTemplate.id)
    setSelectedSignatureId(signature?.id ?? '')
    setLibraryMessage(`Applied template “${selectedTemplate.name}”.`)
  }

  async function handleCopySelectedTemplate() {
    if (!selectedTemplate) {
      setLibraryMessage('Choose a template before exporting it.')
      return
    }

    await writeClipboardText(
      serializeLibraryBundle({
        version: 1,
        signatures: [],
        templates: [selectedTemplate],
        variableSets: [],
      }),
    )
    setLibraryMessage(`Copied template “${selectedTemplate.name}”.`)
  }

  async function handleAddSignature() {
    const name = window.prompt('Signature name:')
    const html = name ? window.prompt('Signature HTML:') : null

    if (!name || !html) {
      return
    }

    const signature = createLocalSignature({
      html,
      id: createBrowserId('sig'),
      name,
      updatedAt: new Date().toISOString(),
    })
    const next = { ...library, signatures: [...library.signatures, signature] }
    setSelectedSignatureId(signature.id)
    await persistLibrary(next, `Saved signature “${signature.name}”.`)
  }

  async function handleInsertSignature() {
    if (!selectedSignature) {
      setLibraryMessage('Choose a signature before inserting it.')
      return
    }

    const email = await requireCurrentEmail()
    const html = appendSignatureHtml(email.html, selectedSignature.html)
    setSelectedSignatureId(selectedSignature.id)
    applyDraftToEditor(
      draftFromEditorState({
        gmail: gmailLink ? { ...gmailLink, status: 'pending' } : undefined,
        html,
        recipients: draftRecipients,
        selectedSignatureId: selectedSignature.id,
        selectedTemplateId,
        sourceHtml: html,
        subject: draftSubject,
        text: stripHtml(html),
      }),
    )
    setLibraryMessage(`Inserted signature “${selectedSignature.name}”.`)
  }

  async function handleCopySelectedSignature() {
    if (!selectedSignature) {
      setLibraryMessage('Choose a signature before exporting it.')
      return
    }

    await writeClipboardText(
      serializeLibraryBundle({
        version: 1,
        signatures: [selectedSignature],
        templates: [],
        variableSets: [],
      }),
    )
    setLibraryMessage(`Copied signature “${selectedSignature.name}”.`)
  }

  async function handleImportGmailSignatures() {
    if (!gmailStatus.connected) {
      setLibraryMessage('Connect Gmail before importing Gmail signatures.')
      return
    }

    if (!canImportGmailSignatures) {
      window.location.assign('/api/gmail/connect?scope=signatures')
      return
    }

    setLibraryBusy(true)

    try {
      const signatures = await importGmailSignatures()
      const next = mergeLibraryBundles(library, {
        version: 1,
        signatures,
        templates: [],
        variableSets: [],
      })
      await persistLibrary(
        next,
        `Imported ${signatures.length} Gmail signature${signatures.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      setLibraryMessage(getLibraryErrorMessage(error))
    } finally {
      setLibraryBusy(false)
    }
  }

  async function handleSaveVariableSet() {
    const name = window.prompt('Variable set name:')
    const raw = name
      ? window.prompt('Variable JSON, for example {"first_name":"Ada"}:')
      : null

    if (!name || !raw) {
      return
    }

    try {
      const values = parseStringRecord(JSON.parse(raw) as unknown)
      const variableSet: VariableSet = {
        id: createBrowserId('vars'),
        name,
        updatedAt: new Date().toISOString(),
        values,
      }
      const next = {
        ...library,
        variableSets: [...library.variableSets, variableSet],
      }
      setSelectedVariableSetId(variableSet.id)
      await persistLibrary(next, `Saved variable set “${variableSet.name}”.`)
    } catch {
      setLibraryMessage('Variable set import needs a valid JSON object.')
    }
  }

  async function handleCopySelectedVariableSet() {
    if (!selectedVariableSet) {
      setLibraryMessage('Choose a variable set before exporting it.')
      return
    }

    await writeClipboardText(
      serializeLibraryBundle({
        version: 1,
        signatures: [],
        templates: [],
        variableSets: [selectedVariableSet],
      }),
    )
    setLibraryMessage(`Copied variable set “${selectedVariableSet.name}”.`)
  }

  async function handleExportLibrary() {
    await writeClipboardText(serializeLibraryBundle(library))
    setLibraryMessage('Copied the whole local library bundle.')
  }

  async function handleImportLibrary() {
    const raw = window.prompt('Paste a Copy to Gmail library JSON bundle:')

    if (!raw) {
      return
    }

    try {
      const imported = parseLibraryBundle(JSON.parse(raw) as unknown)
      await persistLibrary(
        mergeLibraryBundles(library, imported),
        'Imported the library bundle.',
      )
    } catch {
      setLibraryMessage('Library import needs valid JSON.')
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

  async function requireCurrentDraft(
    status: GmailDraftLink['status'] = gmailLink?.status ?? 'unlinked',
  ): Promise<LocalDraft> {
    const email = await requireCurrentEmail()
    const draft = draftFromEditorState({
      gmail: gmailLink ? { ...gmailLink, status } : undefined,
      html: email.html,
      recipients: draftRecipients,
      selectedSignatureId: selectedSignatureId || undefined,
      selectedTemplateId: selectedTemplateId || undefined,
      sourceHtml,
      subject: draftSubject,
      text: email.text || stripHtml(sanitizeEmailBodyHtml(email.html)),
    })
    const fingerprint = await fingerprintDraft(draft)

    return gmailLink
      ? {
          ...draft,
          gmail: {
            ...gmailLink,
            lastSyncedFingerprint:
              gmailLink.lastSyncedFingerprint || fingerprint,
            status,
            updatedAt: new Date().toISOString(),
          },
        }
      : draft
  }

  function applyDraftToEditor(draft: LocalDraft) {
    const html = sanitizeEmailBodyHtml(draft.html)
    const email = { html, text: draft.text || stripHtml(html) }
    setDraftSubject(draft.subject)
    setDraftRecipients(draft.recipients)
    setGmailLink(draft.gmail)
    setSelectedSignatureId(draft.selectedSignatureId ?? '')
    setSelectedTemplateId(draft.selectedTemplateId ?? '')
    setSourceHtml(draft.sourceHtml || html)
    setEditorContent(html)
    setEditorKey((key) => key + 1)
    latestEmailRef.current = email
    setLatestEmail(email)
  }

  function applySyncedGmailLink(
    link: GmailDraftLink | undefined,
    fingerprint: string,
  ) {
    if (!link) {
      return
    }

    setGmailLink({
      ...link,
      accountEmail: gmailStatus.email ?? link.accountEmail,
      lastSyncedFingerprint: fingerprint,
      status: 'synced',
      updatedAt: new Date().toISOString(),
    })
    setGmailConflict(null)
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
              <img src="/brand-mark.svg" alt="" />
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
                <div className="metadata-grid" aria-label="Draft metadata">
                  <label className="metadata-field metadata-field-subject">
                    <span className="field-label">Subject</span>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Add a Gmail subject"
                    />
                  </label>
                  <label className="metadata-field">
                    <span className="field-label">To</span>
                    <input
                      type="text"
                      value={draftRecipients.to}
                      onChange={(event) =>
                        setDraftRecipients((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                      placeholder="person@example.com"
                    />
                  </label>
                  <label className="metadata-field">
                    <span className="field-label">Cc</span>
                    <input
                      type="text"
                      value={draftRecipients.cc}
                      onChange={(event) =>
                        setDraftRecipients((current) => ({
                          ...current,
                          cc: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="metadata-field">
                    <span className="field-label">Bcc</span>
                    <input
                      type="text"
                      value={draftRecipients.bcc}
                      onChange={(event) =>
                        setDraftRecipients((current) => ({
                          ...current,
                          bcc: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
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
            <GmailPanel
              busy={gmailBusy}
              drafts={gmailDrafts}
              link={gmailLink}
              message={gmailMessage}
              openUrl={openGmailUrl}
              status={gmailStatus}
              onConnect={handleGmailConnect}
              onCreateDraft={() => void handleCreateGmailDraft()}
              onDisconnect={() => void handleGmailDisconnect()}
              onLoadDraft={(id) => void handleLoadGmailDraft(id)}
              onLoadDrafts={() => void handleLoadGmailDrafts()}
              onRefresh={() => void refreshGmailStatus()}
              onUpdateDraft={() => void handleUpdateGmailDraft()}
            />
            {gmailConflict ? (
              <ConflictPanel
                conflict={gmailConflict}
                onCancel={handleCancelConflict}
                onOverwrite={() => void handleOverwriteGmailConflict()}
                onReplaceLocal={handleReplaceLocalConflict}
                onSaveNew={() => void handleSaveNewConflictVersion()}
              />
            ) : null}
            <LibraryPanel
              busy={libraryBusy}
              canImportGmailSignatures={canImportGmailSignatures}
              library={library}
              message={libraryMessage}
              selectedSignatureId={selectedSignatureId}
              selectedTemplateId={selectedTemplateId}
              selectedVariableSetId={selectedVariableSetId}
              onAddSignature={() => void handleAddSignature()}
              onApplyTemplate={handleApplyTemplate}
              onCopyLibrary={() => void handleExportLibrary()}
              onCopySignature={() => void handleCopySelectedSignature()}
              onCopyTemplate={() => void handleCopySelectedTemplate()}
              onCopyVariableSet={() => void handleCopySelectedVariableSet()}
              onImportGmailSignatures={() => void handleImportGmailSignatures()}
              onImportLibrary={() => void handleImportLibrary()}
              onInsertSignature={() => void handleInsertSignature()}
              onSaveTemplate={() => void handleSaveTemplate()}
              onSaveVariableSet={() => void handleSaveVariableSet()}
              onSelectSignature={setSelectedSignatureId}
              onSelectTemplate={setSelectedTemplateId}
              onSelectVariableSet={setSelectedVariableSetId}
            />
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

function GmailPanel({
  busy,
  drafts,
  link,
  message,
  openUrl,
  status,
  onConnect,
  onCreateDraft,
  onDisconnect,
  onLoadDraft,
  onLoadDrafts,
  onRefresh,
  onUpdateDraft,
}: {
  busy: boolean
  drafts: GmailDraftSummary[]
  link?: GmailDraftLink
  message: string
  openUrl: string
  status: GmailAuthStatus
  onConnect: () => void
  onCreateDraft: () => void
  onDisconnect: () => void
  onLoadDraft: (id: string) => void
  onLoadDrafts: () => void
  onRefresh: () => void
  onUpdateDraft: () => void
}) {
  return (
    <section className="panel-card gmail-card" aria-labelledby="gmail-heading">
      <div className="panel-card-header">
        <div>
          <span className="field-label">Optional sync</span>
          <h2 id="gmail-heading">Gmail drafts</h2>
        </div>
        <span className={`sync-pill sync-${link?.status ?? 'unlinked'}`}>
          {link?.status ?? (status.connected ? 'connected' : 'local only')}
        </span>
      </div>
      <p>{message || 'Connect Gmail only if you want draft sync.'}</p>
      {status.connected ? (
        <div className="gmail-actions">
          <span className="local-badge">
            {status.email ?? 'Gmail connected'}
          </span>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy}
            onClick={onLoadDrafts}
          >
            Load drafts
          </button>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy}
            onClick={onCreateDraft}
          >
            Create draft
          </button>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy || !link?.draftId}
            onClick={onUpdateDraft}
          >
            Sync linked
          </button>
          <a
            className="secondary-action compact-action"
            href={openUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Gmail
          </a>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="gmail-actions">
          <button
            type="button"
            className="primary-action compact-action"
            disabled={busy || status.needsConfig}
            onClick={onConnect}
          >
            Connect Gmail
          </button>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy}
            onClick={onRefresh}
          >
            Refresh status
          </button>
        </div>
      )}
      {drafts.length ? (
        <ul className="gmail-draft-list">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <button
                type="button"
                className="draft-row"
                disabled={busy}
                onClick={() => onLoadDraft(draft.id)}
              >
                <strong>{draft.subject}</strong>
                <span>{draft.snippet || draft.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ConflictPanel({
  conflict,
  onCancel,
  onOverwrite,
  onReplaceLocal,
  onSaveNew,
}: {
  conflict: GmailConflictState
  onCancel: () => void
  onOverwrite: () => void
  onReplaceLocal: () => void
  onSaveNew: () => void
}) {
  return (
    <section
      className="panel-card conflict-card"
      aria-labelledby="conflict-heading"
    >
      <div className="panel-card-header">
        <div>
          <span className="field-label">Sync paused</span>
          <h2 id="conflict-heading">Draft conflict</h2>
        </div>
        <span className="sync-pill sync-conflict">conflict</span>
      </div>
      <p>
        Gmail changed after the last sync. Compare the local draft and the
        current Gmail draft before choosing what survives.
      </p>
      <div className="conflict-grid">
        <DraftSummary title="Local edits" draft={conflict.localDraft} />
        <DraftSummary title="Gmail draft" draft={conflict.remoteDraft} />
      </div>
      <div className="gmail-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onReplaceLocal}
        >
          Replace local
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onOverwrite}
        >
          Overwrite Gmail
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onSaveNew}
        >
          Save new version
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}

function DraftSummary({ draft, title }: { draft: LocalDraft; title: string }) {
  const text = draft.text || stripHtml(draft.html)

  return (
    <div className="conflict-summary">
      <strong>{title}</strong>
      <dl>
        <div>
          <dt>Subject</dt>
          <dd>{draft.subject || '(no subject)'}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{draft.recipients.to || '(none)'}</dd>
        </div>
        <div>
          <dt>Body</dt>
          <dd>{text.slice(0, 120) || '(empty)'}</dd>
        </div>
      </dl>
    </div>
  )
}

function LibraryPanel({
  busy,
  canImportGmailSignatures,
  library,
  message,
  selectedSignatureId,
  selectedTemplateId,
  selectedVariableSetId,
  onAddSignature,
  onApplyTemplate,
  onCopyLibrary,
  onCopySignature,
  onCopyTemplate,
  onCopyVariableSet,
  onImportGmailSignatures,
  onImportLibrary,
  onInsertSignature,
  onSaveTemplate,
  onSaveVariableSet,
  onSelectSignature,
  onSelectTemplate,
  onSelectVariableSet,
}: {
  busy: boolean
  canImportGmailSignatures: boolean
  library: LibraryBundle
  message: string
  selectedSignatureId: string
  selectedTemplateId: string
  selectedVariableSetId: string
  onAddSignature: () => void
  onApplyTemplate: () => void
  onCopyLibrary: () => void
  onCopySignature: () => void
  onCopyTemplate: () => void
  onCopyVariableSet: () => void
  onImportGmailSignatures: () => void
  onImportLibrary: () => void
  onInsertSignature: () => void
  onSaveTemplate: () => void
  onSaveVariableSet: () => void
  onSelectSignature: (id: string) => void
  onSelectTemplate: (id: string) => void
  onSelectVariableSet: (id: string) => void
}) {
  return (
    <section
      className="panel-card library-card"
      aria-labelledby="library-heading"
    >
      <div className="panel-card-header">
        <div>
          <span className="field-label">Local library</span>
          <h2 id="library-heading">Templates</h2>
        </div>
        <span className="local-badge">
          {library.templates.length} / {library.signatures.length} /{' '}
          {library.variableSets.length}
        </span>
      </div>
      <p>
        Reusable templates, signatures, and variable sets stay in protected app
        data when the packaged server is running.
      </p>
      <label className="library-field">
        <span className="field-label">Template</span>
        <select
          value={selectedTemplateId}
          onChange={(event) => onSelectTemplate(event.target.value)}
        >
          <option value="">Choose template</option>
          {library.templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <div className="gmail-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onApplyTemplate}
        >
          Apply
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onSaveTemplate}
        >
          Save current
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onCopyTemplate}
        >
          Copy template
        </button>
      </div>
      <label className="library-field">
        <span className="field-label">Signature</span>
        <select
          value={selectedSignatureId}
          onChange={(event) => onSelectSignature(event.target.value)}
        >
          <option value="">Choose signature</option>
          {library.signatures.map((signature) => (
            <option key={signature.id} value={signature.id}>
              {signature.source === 'gmail' ? 'Gmail: ' : ''}
              {signature.name}
            </option>
          ))}
        </select>
      </label>
      <div className="gmail-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onInsertSignature}
        >
          Insert
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onAddSignature}
        >
          Add local
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onCopySignature}
        >
          Copy signature
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={busy}
          onClick={onImportGmailSignatures}
        >
          {canImportGmailSignatures ? 'Import Gmail' : 'Enable Gmail import'}
        </button>
      </div>
      <label className="library-field">
        <span className="field-label">Variables</span>
        <select
          value={selectedVariableSetId}
          onChange={(event) => onSelectVariableSet(event.target.value)}
        >
          <option value="">Prompt for values</option>
          {library.variableSets.map((variableSet) => (
            <option key={variableSet.id} value={variableSet.id}>
              {variableSet.name}
            </option>
          ))}
        </select>
      </label>
      <div className="gmail-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onSaveVariableSet}
        >
          Add set
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onCopyVariableSet}
        >
          Copy set
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onCopyLibrary}
        >
          Export all
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={onImportLibrary}
        >
          Import bundle
        </button>
      </div>
      {message ? <p className="library-message">{message}</p> : null}
    </section>
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

function collectPlaceholderValues(
  template: EmailTemplate,
  defaults: Record<string, string>,
): Record<string, string> {
  const names = collectTemplateVariables({
    html: template.html,
    recipients: template.recipients,
    subject: template.subject,
  })
  const variables = new Map(
    template.variables.map((variable) => [variable.name, variable]),
  )

  return Object.fromEntries(
    names.map((name) => {
      const variable = variables.get(name)
      const fallback = defaults[name] ?? variable?.defaultValue ?? ''
      const label = variable?.label ?? name
      return [
        name,
        window.prompt(`Value for {{${label}}}:`, fallback) ?? fallback,
      ]
    }),
  )
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object of string values.')
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function createBrowserId(prefix: string): string {
  const cryptoId = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${cryptoId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`
}

function getLibraryErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Local library request failed.'
}

function getSystemDarkPreference(): boolean {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

function getGmailErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Gmail sync request failed.'
}

export default App
