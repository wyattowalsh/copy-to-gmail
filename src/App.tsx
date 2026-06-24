import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import '@react-email/editor/themes/default.css'
import {
  ChevronDown,
  CheckCircle2,
  Copy,
  Eye,
  FileCode2,
  LaptopMinimal,
  Mail,
  MoreHorizontal,
  Moon,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sun,
  Type,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  copyRichHtmlToClipboard,
  sanitizeEmailBodyHtml,
  stripHtml,
} from './lib/clipboard'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from './components/ui/alert-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from './components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'
import { analyzeEmailBody } from './lib/emailSafety'
import {
  analyzeGmailReadiness,
  getClipboardCapabilities,
  type GmailReadinessReport,
} from './lib/readiness'
import {
  createThemeStyle,
  getThemePresetIndexEntry,
  parseThemeJson,
  resolveTheme,
  searchThemePresets,
  serializeTheme,
  THEME_PRESET_CATEGORIES,
  THEME_PRESETS,
  type ThemeDefinition,
  type ThemePresetCategory,
  type ThemePreference,
} from './lib/themes'
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
  type DefaultPreviewMode,
  type EditorCanvasSize,
  type EditorMode,
  type InspectorDefault,
} from './lib/settings'
import {
  draftFromEditorState,
  normalizeRecipientList,
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
import { cn } from './lib/utils'
import './App.css'

type CopyState = 'idle' | 'copying' | 'copied' | 'error'
type MessageTone = 'neutral' | 'success' | 'warning' | 'error'
type PreviewMode = 'rendered' | 'plain' | 'source'
type FormFieldKind = 'text' | 'textarea'
type DraftMetrics = {
  chars: number
  links: number
  warnings: number
  words: number
}

type EmailExport = {
  html: string
  text: string
}

type GmailConflictState = {
  localDraft: LocalDraft
  remoteDraft: LocalDraft
  remoteFingerprint: string
}

type ConfirmDialogState = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

type FormDialogField = {
  id: string
  kind: FormFieldKind
  label: string
  value: string
  placeholder?: string
  rows?: number
}

type FormDialogState = {
  title: string
  description: string
  submitLabel: string
  fields: FormDialogField[]
  error?: string
  onSubmit: (values: Record<string, string>) => void | Promise<void>
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
  const settingsCloseRef = useRef<HTMLButtonElement>(null)
  const settingsOpenerRef = useRef<HTMLElement | null>(null)
  const confirmDialogOpenerRef = useRef<HTMLElement | null>(null)
  const confirmDialogFallbackFocusRef = useRef<HTMLElement | null>(null)
  const formDialogOpenerRef = useRef<HTMLElement | null>(null)
  const formDialogFallbackFocusRef = useRef<HTMLElement | null>(null)
  const moreActionsTriggerRef = useRef<HTMLButtonElement>(null)
  const appContentRef = useRef<HTMLDivElement>(null)
  const autosyncTimerRef = useRef<number | undefined>(undefined)
  const launchFocusDoneRef = useRef(false)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [editorMode, setEditorMode] = useState<EditorMode>(settings.editorMode)
  const [isFocusWorkspace, setFocusWorkspace] = useState(
    settings.focusEditorOnLaunch,
  )
  const [isNarrowInspectorViewport, setNarrowInspectorViewport] = useState(() =>
    getNarrowInspectorViewport(),
  )
  const [isCompactComposerViewport, setCompactComposerViewport] = useState(() =>
    getCompactComposerViewport(),
  )
  const [isMetadataOpen, setMetadataOpen] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [editorContent, setEditorContent] = useState(starterContent)
  const [sourceHtml, setSourceHtml] = useState(starterContent.trim())
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [messageTone, setMessageTone] = useState<MessageTone>('neutral')
  const [message, setMessage] = useState('')
  const [latestEmail, setLatestEmail] = useState<EmailExport | null>(null)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isMoreActionsOpen, setMoreActionsOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    settings.defaultPreviewMode,
  )
  const [themeJsonDraft, setThemeJsonDraft] = useState('')
  const [themeJsonError, setThemeJsonError] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  )
  const [isConfirmDialogSubmitting, setConfirmDialogSubmitting] =
    useState(false)
  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null)
  const [isFormDialogSubmitting, setFormDialogSubmitting] = useState(false)
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
  const readinessIssueCount = draftMetrics.warnings
  const libraryCounts = {
    signatures: library.signatures.length,
    templates: library.templates.length,
    variableSets: library.variableSets.length,
  }
  const isInspectorCollapsed =
    isFocusWorkspace ||
    settings.inspectorDefault === 'collapsed' ||
    (settings.inspectorDefault === 'auto' && isNarrowInspectorViewport)
  const showGmailControls =
    settings.keepGmailControlsVisible ||
    gmailStatus.connected ||
    Boolean(gmailLink || gmailConflict)
  const metadataRecipientCount = getRecipientCount(draftRecipients)
  const metadataSubjectSummary = draftSubject.trim() || 'No subject'
  const metadataRecipientSummary = metadataRecipientCount
    ? formatCount(metadataRecipientCount, 'recipient')
    : 'No recipients'
  const isMetadataDisclosureActive = isCompactComposerViewport
  const isMetadataCollapsed = isMetadataDisclosureActive && !isMetadataOpen
  const isMoreActionsCompact = editorMode === 'source'
  const isMoreActionsNarrow = isNarrowInspectorViewport
  const moreActionsPlacement = isMoreActionsCompact
    ? 'compact'
    : isMoreActionsNarrow
      ? 'narrow'
      : 'standard'

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
    const media = window.matchMedia?.('(max-width: 1180px)')

    if (!media) {
      return
    }

    const updateViewport = () => setNarrowInspectorViewport(media.matches)
    updateViewport()
    media.addEventListener('change', updateViewport)

    return () => media.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 760px)')

    if (!media) {
      return
    }

    const updateViewport = () => setCompactComposerViewport(media.matches)
    updateViewport()
    media.addEventListener('change', updateViewport)

    return () => media.removeEventListener('change', updateViewport)
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
    if (isPreviewOpen || isSettingsOpen) {
      setMoreActionsOpen(false)
    }
  }, [isPreviewOpen, isSettingsOpen])

  useEffect(() => {
    const appContent = appContentRef.current
    const previousOverflow = document.body.style.overflow
    const isLayerOpen =
      isPreviewOpen || isSettingsOpen || Boolean(confirmDialog || formDialog)

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
  }, [confirmDialog, formDialog, isPreviewOpen, isSettingsOpen])

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
      setMoreActionsOpen(false)
      setPreviewMode(settings.defaultPreviewMode)
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
      setMoreActionsOpen(false)
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
    setMoreActionsOpen(false)
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
    setMoreActionsOpen(false)
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

  function resetStarterDraft() {
    const email = buildSourceEmail(starterContent)
    setSourceHtml(starterContent.trim())
    setEditorContent(starterContent)
    setEditorKey((key) => key + 1)
    latestEmailRef.current = email
    setLatestEmail(email)
    setStatus('Starter draft restored.', 'success')
  }

  function handleResetStarter() {
    const hasDraft = Boolean(activeEmail?.html || sourceHtml.trim())

    if (!hasDraft) {
      resetStarterDraft()
      return
    }

    setMoreActionsOpen(false)
    openConfirmDialog({
      title: 'Reset starter draft?',
      description:
        'This replaces the current local draft body with the starter email. Subject, recipients, and local library items are not changed.',
      confirmLabel: 'Reset draft',
      onConfirm: resetStarterDraft,
    })
  }

  function importDraftJson(raw: string) {
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
      throw new Error(
        error instanceof Error ? error.message : 'Unable to import draft JSON.',
        { cause: error },
      )
    }
  }

  function handleImportDraftJson() {
    setMoreActionsOpen(false)
    openFormDialog({
      title: 'Import draft JSON',
      description:
        'Paste a draft exported from Copy to Gmail. Import replaces the local composer fields only after the JSON validates.',
      submitLabel: 'Import draft',
      fields: [
        {
          id: 'json',
          kind: 'textarea',
          label: 'Draft JSON',
          value: '',
          rows: 10,
        },
      ],
      onSubmit: ({ json }) => {
        if (!json.trim()) {
          throw new Error('Paste draft JSON before importing.')
        }

        importDraftJson(json)
      },
    })
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

  function handleOverwriteGmailConflict() {
    if (!gmailConflict || !gmailLink?.draftId) {
      return
    }

    openConfirmDialog({
      title: 'Overwrite Gmail draft?',
      description:
        'This replaces the changed Gmail draft with your local edits. Use Save new version if you want to keep both drafts.',
      confirmLabel: 'Overwrite Gmail',
      onConfirm: async () => {
        if (!gmailConflict || !gmailLink?.draftId) {
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
      },
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

  function handleSaveTemplate() {
    openFormDialog({
      title: 'Save template',
      description:
        'Save the current local draft as a reusable template in the local library.',
      submitLabel: 'Save template',
      fields: [
        {
          id: 'name',
          kind: 'text',
          label: 'Template name',
          value: '',
        },
      ],
      onSubmit: async ({ name }) => {
        const templateName = name.trim()

        if (!templateName) {
          throw new Error('Name the template before saving.')
        }

        const draft = await requireCurrentDraft('pending')
        const template = createTemplateFromDraft({
          draft,
          id: createBrowserId('tpl'),
          name: templateName,
          updatedAt: new Date().toISOString(),
        })
        const next = {
          ...library,
          templates: [...library.templates, template],
        }
        setSelectedTemplateId(template.id)
        await persistLibrary(next, `Saved template “${template.name}”.`)
      },
    })
  }

  function handleApplyTemplate() {
    if (!selectedTemplate) {
      setLibraryMessage('Choose a template before applying it.')
      return
    }

    const fields = collectPlaceholderFields(
      selectedTemplate,
      selectedVariableSet?.values ?? {},
    )

    if (fields.length) {
      openFormDialog({
        title: 'Fill template variables',
        description:
          'These values are inserted into the selected template before it replaces the local draft.',
        submitLabel: 'Apply template',
        fields,
        onSubmit: (values) => {
          applySelectedTemplate(values)
        },
      })
      return
    }

    applySelectedTemplate({})
  }

  function applySelectedTemplate(values: Record<string, string>) {
    if (!selectedTemplate) {
      setLibraryMessage('Choose a template before applying it.')
      return
    }

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

  function handleAddSignature() {
    openFormDialog({
      title: 'Add local signature',
      description:
        'Save a reusable HTML signature in the local library. The HTML is sanitized when inserted into a draft.',
      submitLabel: 'Save signature',
      fields: [
        {
          id: 'name',
          kind: 'text',
          label: 'Signature name',
          value: '',
        },
        {
          id: 'html',
          kind: 'textarea',
          label: 'Signature HTML',
          value: '',
          rows: 8,
        },
      ],
      onSubmit: async ({ html, name }) => {
        const signatureName = name.trim()

        if (!signatureName || !html.trim()) {
          throw new Error('Add both a signature name and HTML.')
        }

        const signature = createLocalSignature({
          html,
          id: createBrowserId('sig'),
          name: signatureName,
          updatedAt: new Date().toISOString(),
        })
        const next = {
          ...library,
          signatures: [...library.signatures, signature],
        }
        setSelectedSignatureId(signature.id)
        await persistLibrary(next, `Saved signature “${signature.name}”.`)
      },
    })
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

  function handleSaveVariableSet() {
    openFormDialog({
      title: 'Add variable set',
      description:
        'Save a JSON object of string values for template placeholders.',
      submitLabel: 'Save set',
      fields: [
        {
          id: 'name',
          kind: 'text',
          label: 'Variable set name',
          value: '',
        },
        {
          id: 'json',
          kind: 'textarea',
          label: 'Variable JSON',
          placeholder: '{"first_name":"Ada"}',
          value: '',
          rows: 8,
        },
      ],
      onSubmit: async ({ json, name }) => {
        const variableSetName = name.trim()

        if (!variableSetName || !json.trim()) {
          throw new Error('Add a variable set name and JSON object.')
        }

        try {
          const values = parseStringRecord(JSON.parse(json) as unknown)
          const variableSet: VariableSet = {
            id: createBrowserId('vars'),
            name: variableSetName,
            updatedAt: new Date().toISOString(),
            values,
          }
          const next = {
            ...library,
            variableSets: [...library.variableSets, variableSet],
          }
          setSelectedVariableSetId(variableSet.id)
          await persistLibrary(
            next,
            `Saved variable set “${variableSet.name}”.`,
          )
        } catch {
          throw new Error('Variable set import needs a valid JSON object.')
        }
      },
    })
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

  function handleImportLibrary() {
    openFormDialog({
      title: 'Import library bundle',
      description:
        'Paste a Copy to Gmail library bundle. Valid templates, signatures, and variable sets merge into the local library.',
      submitLabel: 'Import bundle',
      fields: [
        {
          id: 'json',
          kind: 'textarea',
          label: 'Library JSON',
          value: '',
          rows: 10,
        },
      ],
      onSubmit: async ({ json }) => {
        if (!json.trim()) {
          throw new Error('Paste a library JSON bundle before importing.')
        }

        try {
          const imported = parseLibraryBundle(JSON.parse(json) as unknown)
          await persistLibrary(
            mergeLibraryBundles(library, imported),
            'Imported the library bundle.',
          )
        } catch {
          throw new Error('Library import needs valid JSON.')
        }
      },
    })
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
    setThemeJsonDraft(serializeTheme(theme))
    setThemeJsonError('')
    setStatus(`Applied ${theme.name}.`, 'success')
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  function openConfirmDialog(dialog: ConfirmDialogState) {
    const opener = getActiveHTMLElement()
    confirmDialogOpenerRef.current = opener
    confirmDialogFallbackFocusRef.current =
      isMoreActionsOpen || opener?.closest('[role="menuitem"]')
        ? moreActionsTriggerRef.current
        : null
    setConfirmDialog(dialog)
  }

  function closeConfirmDialog() {
    setConfirmDialog(null)
    restoreFocus(confirmDialogOpenerRef, confirmDialogFallbackFocusRef)
  }

  function openFormDialog(dialog: FormDialogState) {
    const opener = getActiveHTMLElement()
    formDialogOpenerRef.current = opener
    formDialogFallbackFocusRef.current =
      isMoreActionsOpen || opener?.closest('[role="menuitem"]')
        ? moreActionsTriggerRef.current
        : null
    setFormDialog(dialog)
  }

  function closeFormDialog() {
    setFormDialog(null)
    restoreFocus(formDialogOpenerRef, formDialogFallbackFocusRef)
  }

  function updateFormDialogField(fieldId: string, value: string) {
    setFormDialog((current) =>
      current
        ? {
            ...current,
            error: '',
            fields: current.fields.map((field) =>
              field.id === fieldId ? { ...field, value } : field,
            ),
          }
        : current,
    )
  }

  async function submitFormDialog() {
    if (!formDialog || isFormDialogSubmitting) {
      return
    }

    const currentDialog = formDialog
    const values = Object.fromEntries(
      currentDialog.fields.map((field) => [field.id, field.value]),
    )

    setFormDialogSubmitting(true)
    try {
      await currentDialog.onSubmit(values)
      closeFormDialog()
    } catch (error) {
      setFormDialog((current) =>
        current === currentDialog
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to complete this action.',
            }
          : current,
      )
    } finally {
      setFormDialogSubmitting(false)
    }
  }

  async function submitConfirmDialog() {
    if (!confirmDialog || isConfirmDialogSubmitting) {
      return
    }

    const currentDialog = confirmDialog

    setConfirmDialogSubmitting(true)
    try {
      await currentDialog.onConfirm()
      closeConfirmDialog()
    } finally {
      setConfirmDialogSubmitting(false)
    }
  }

  function handleResetSettings() {
    const reset = () => {
      const nextSettings = { ...defaultSettings }
      const nextTheme = resolveTheme(
        nextSettings.themePreference,
        nextSettings.selectedThemeId,
        undefined,
        prefersDark,
      )
      setSettings(nextSettings)
      setThemeJsonDraft(serializeTheme(nextTheme))
      setThemeJsonError('')
      setStatus('Settings reset to defaults.', 'success')
    }

    const isThemeJsonDirty =
      themeJsonDraft.trim() !== serializeTheme(activeTheme).trim()

    if (settings.customTheme || themeJsonError || isThemeJsonDirty) {
      openConfirmDialog({
        title: 'Reset settings?',
        description:
          'This restores the default app settings and clears any custom theme JSON in this dialog.',
        confirmLabel: 'Reset settings',
        onConfirm: reset,
      })
      return
    }

    reset()
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

    if (settings.focusEditorOnLaunch && !launchFocusDoneRef.current) {
      launchFocusDoneRef.current = true
      setFocusWorkspace(true)
      window.requestAnimationFrame(focusEditorSurface)
    }
  }

  function handleEditorUpdate(ref: EmailEditorRef) {
    editorRef.current = ref
    labelEditorSurface()
    void refreshEmailCache(ref)
  }

  function focusEditorSurface() {
    const target =
      editorMode === 'source'
        ? document.getElementById('source-html')
        : document.querySelector<HTMLElement>('.email-editor .tiptap')

    target?.focus()
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
      data-editor-canvas={settings.editorCanvas}
      data-density={activeTheme.tokens.density}
      data-focus-workspace={isFocusWorkspace ? 'true' : undefined}
      data-inspector={isInspectorCollapsed ? 'collapsed' : 'expanded'}
      data-theme-mode={activeTheme.mode}
      style={themeStyle}
    >
      <div ref={appContentRef} className="app-content">
        <header className="app-chrome floating-chrome">
          <div className="brand-block">
            <span className="app-mark" aria-hidden="true">
              <img src="/icon.png?v=transparent" alt="" />
            </span>
            <div>
              <h1>Copy to Gmail</h1>
            </div>
          </div>
          <div className="chrome-actions">
            <ThemeSwitcher
              hasCustomTheme={Boolean(settings.customTheme)}
              preference={settings.themePreference}
              themeStyle={themeStyle}
              onPreference={handleThemePreference}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="icon-button settings-action"
              onClick={openSettings}
              aria-label="Settings"
              title="Settings"
            >
              <Settings2 aria-hidden="true" size={16} strokeWidth={2.1} />
            </Button>
          </div>
        </header>

        <div className="studio-grid floating-studio">
          <section
            className="composer editor-workbench"
            aria-labelledby="editor-heading"
          >
            <div className="editor-frame">
              <div className="editor-main">
                <WorkflowStrip
                  busy={gmailBusy}
                  link={gmailLink}
                  message={message}
                  messageTone={messageTone}
                  openUrl={openGmailUrl}
                  readiness={readiness}
                  showControls={showGmailControls}
                  syncMessage={gmailMessage}
                  syncStatus={gmailStatus}
                  themeStyle={themeStyle}
                  onConnect={handleGmailConnect}
                  onCreateDraft={() => void handleCreateGmailDraft()}
                  onLoadDrafts={() => void handleLoadGmailDrafts()}
                  onRefresh={() => void refreshGmailStatus()}
                  onUpdateDraft={() => void handleUpdateGmailDraft()}
                />
                {isFocusWorkspace ? null : (
                  <section
                    className="metadata-shell"
                    aria-label="Draft metadata"
                    data-metadata-state={
                      isMetadataCollapsed ? 'collapsed' : 'expanded'
                    }
                  >
                    {isMetadataDisclosureActive ? (
                      <button
                        type="button"
                        className="metadata-disclosure"
                        aria-expanded={isMetadataOpen}
                        aria-controls="draft-metadata-fields"
                        aria-label={
                          isMetadataOpen
                            ? `Collapse subject and recipients, ${metadataSubjectSummary}, ${metadataRecipientSummary}`
                            : `Expand subject and recipients, ${metadataSubjectSummary}, ${metadataRecipientSummary}`
                        }
                        onClick={() => setMetadataOpen((current) => !current)}
                      >
                        <span className="metadata-disclosure-label">
                          Subject and recipients
                        </span>
                        <span
                          className="metadata-disclosure-summary"
                          aria-hidden="true"
                        >
                          <span>{metadataSubjectSummary}</span>
                          <span>{metadataRecipientSummary}</span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="metadata-disclosure-icon"
                          size={16}
                          strokeWidth={2.1}
                        />
                      </button>
                    ) : null}
                    <div
                      id="draft-metadata-fields"
                      className="metadata-grid"
                      hidden={isMetadataCollapsed}
                    >
                      <label className="metadata-field metadata-field-subject">
                        <span className="field-label">
                          <Type
                            aria-hidden="true"
                            size={12}
                            strokeWidth={2.2}
                          />
                          Subject
                        </span>
                        <input
                          type="text"
                          value={draftSubject}
                          onChange={(event) =>
                            setDraftSubject(event.target.value)
                          }
                          placeholder="Add a Gmail subject"
                        />
                      </label>
                      <label className="metadata-field metadata-field-to">
                        <span className="field-label">
                          <Send
                            aria-hidden="true"
                            size={12}
                            strokeWidth={2.2}
                          />
                          To
                        </span>
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
                      <label className="metadata-field metadata-field-cc">
                        <span className="field-label">
                          <Users
                            aria-hidden="true"
                            size={12}
                            strokeWidth={2.2}
                          />
                          Cc
                        </span>
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
                      <label className="metadata-field metadata-field-bcc">
                        <span className="field-label">
                          <Users
                            aria-hidden="true"
                            size={12}
                            strokeWidth={2.2}
                          />
                          Bcc
                        </span>
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
                  </section>
                )}
                <div
                  className="editor-action-bar floating-toolbelt"
                  role="group"
                  aria-label="Composer tools"
                >
                  <div className="action-group action-group-primary tool-cluster">
                    <Button
                      type="button"
                      variant="primary"
                      className="primary-action"
                      onClick={() => void handleCopyForGmail()}
                      disabled={copyState === 'copying'}
                    >
                      <Copy aria-hidden="true" strokeWidth={2.1} />
                      {copyLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="secondary-action"
                      aria-label="Open preview drawer"
                      onClick={() => void handlePreviewBody()}
                    >
                      <Eye aria-hidden="true" strokeWidth={2.1} />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="secondary-action"
                      onClick={() => void handleValidateNow()}
                    >
                      <CheckCircle2 aria-hidden="true" strokeWidth={2.1} />
                      Validate
                    </Button>
                  </div>
                  <DropdownMenu
                    modal={false}
                    open={isMoreActionsOpen}
                    onOpenChange={setMoreActionsOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={moreActionsTriggerRef}
                        type="button"
                        variant="secondary"
                        className="tool-menu-trigger"
                        aria-label="More actions"
                      >
                        <MoreHorizontal aria-hidden="true" strokeWidth={2.1} />
                        <span className="tool-menu-label-full">
                          More actions
                        </span>
                        <span className="tool-menu-label-short" aria-hidden>
                          More
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={
                        isMoreActionsCompact || isMoreActionsNarrow
                          ? 'end'
                          : 'start'
                      }
                      className={
                        isMoreActionsCompact
                          ? 'tool-menu-panel-compact'
                          : undefined
                      }
                      data-menu-placement={moreActionsPlacement}
                      side={
                        isMoreActionsCompact
                          ? 'top'
                          : isMoreActionsNarrow
                            ? 'bottom'
                            : 'right'
                      }
                      style={themeStyle}
                    >
                      <DropdownMenuLabel>Copy variants</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => void handleCopyPlainText()}
                      >
                        <Type aria-hidden="true" strokeWidth={2.1} />
                        Plain text
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleCopySanitizedHtml()}
                      >
                        <FileCode2 aria-hidden="true" strokeWidth={2.1} />
                        Sanitized HTML
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Draft tools</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => void handleExportDraftJson()}
                      >
                        <FileCode2 aria-hidden="true" strokeWidth={2.1} />
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleImportDraftJson}>
                        <FileCode2 aria-hidden="true" strokeWidth={2.1} />
                        Import JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleClearFormatting()}
                      >
                        <PencilLine aria-hidden="true" strokeWidth={2.1} />
                        Clear formatting
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleResetStarter}>
                        <RefreshCw aria-hidden="true" strokeWidth={2.1} />
                        Reset starter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p id="editor-help" className="sr-only">
                  Compose the email body. Select text for formatting, type slash
                  for blocks, or switch to Source mode to paste HTML.
                </p>
                <EditorCommandBar
                  isFocusWorkspace={isFocusWorkspace}
                  metrics={draftMetrics}
                  mode={editorMode}
                  showMetrics={settings.showEditorMetrics}
                  sourceStats={{
                    blockedElements: sourceAnalysis.unsupportedElements.length,
                    plainTextChars: sourceAnalysis.text.length,
                    unsafeLinks: sourceAnalysis.unsafeLinks.length,
                  }}
                  onFocusWorkspace={() =>
                    setFocusWorkspace((current) => !current)
                  }
                  onFocusEditor={focusEditorSurface}
                  onMode={(mode) => {
                    if (mode === 'source') {
                      void switchToSourceMode()
                      return
                    }

                    switchToVisualMode()
                  }}
                />
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="secondary-action compact-action"
                          onClick={applySourceToVisual}
                        >
                          Apply to visual editor
                        </Button>
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

          <InspectorPanel
            collapsed={isInspectorCollapsed}
            gmailLabel={getGmailWorkflowLabel(gmailStatus, gmailLink)}
            libraryCounts={libraryCounts}
            readinessIssueCount={readinessIssueCount}
            readinessStatus={readiness.status}
            onToggle={() => {
              updateSettings({
                inspectorDefault: isInspectorCollapsed
                  ? 'expanded'
                  : 'collapsed',
              })
            }}
          >
            <GmailPanel
              busy={gmailBusy}
              drafts={gmailDrafts}
              link={gmailLink}
              message={gmailMessage}
              status={gmailStatus}
              onDisconnect={() => void handleGmailDisconnect()}
              onLoadDraft={(id) => void handleLoadGmailDraft(id)}
            />
            {gmailConflict ? (
              <ConflictPanel
                busy={gmailBusy}
                conflict={gmailConflict}
                onCancel={handleCancelConflict}
                onOverwrite={() => void handleOverwriteGmailConflict()}
                onReplaceLocal={handleReplaceLocalConflict}
                onSaveNew={() => void handleSaveNewConflictVersion()}
              />
            ) : null}
            <ReadinessPanel report={readiness} />
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
          </InspectorPanel>
        </div>
      </div>

      {isPreviewOpen ? (
        <PreviewDrawer
          html={pasteableHtml}
          mode={previewMode}
          readiness={readiness}
          sourceHtml={pasteableHtml}
          text={pasteableText}
          themeStyle={themeStyle}
          closeButtonRef={previewCloseRef}
          onClose={closePreview}
          onMode={setPreviewMode}
        />
      ) : null}

      {isSettingsOpen ? (
        <SettingsModal
          activeTheme={activeTheme}
          closeButtonRef={settingsCloseRef}
          settings={settings}
          themeStyle={themeStyle}
          themeJsonDraft={themeJsonDraft}
          themeJsonError={themeJsonError}
          onApplyThemeJson={handleApplyThemeJson}
          onClose={closeSettings}
          onCopyThemeJson={() => void handleCopyThemeJson()}
          onPresetTheme={handleThemePreset}
          onResetSettings={handleResetSettings}
          onSettings={updateSettings}
          onThemeJsonDraft={setThemeJsonDraft}
          onThemePreference={handleThemePreference}
        />
      ) : null}

      {confirmDialog ? (
        <ConfirmDialog
          dialog={confirmDialog}
          isSubmitting={isConfirmDialogSubmitting}
          themeStyle={themeStyle}
          onClose={() => {
            if (!isConfirmDialogSubmitting) {
              closeConfirmDialog()
            }
          }}
          onConfirm={() => {
            void submitConfirmDialog()
          }}
        />
      ) : null}

      {formDialog ? (
        <FormDialog
          dialog={formDialog}
          isSubmitting={isFormDialogSubmitting}
          themeStyle={themeStyle}
          onChangeField={updateFormDialogField}
          onClose={() => {
            if (!isFormDialogSubmitting) {
              closeFormDialog()
            }
          }}
          onSubmit={() => void submitFormDialog()}
        />
      ) : null}
    </main>
  )
}

function EditorCommandBar({
  isFocusWorkspace,
  metrics,
  mode,
  showMetrics,
  sourceStats,
  onFocusEditor,
  onFocusWorkspace,
  onMode,
}: {
  isFocusWorkspace: boolean
  metrics: DraftMetrics
  mode: EditorMode
  showMetrics: boolean
  sourceStats: {
    blockedElements: number
    plainTextChars: number
    unsafeLinks: number
  }
  onFocusEditor: () => void
  onFocusWorkspace: () => void
  onMode: (mode: EditorMode) => void
}) {
  const sourceIssueCount = sourceStats.blockedElements + sourceStats.unsafeLinks

  return (
    <section className="editor-command-bar" aria-label="Editor status">
      <div className="editor-command-summary">
        <div className="editor-command-title-row">
          <span className="field-label">Editor</span>
          <strong className="editor-command-title">Body canvas</strong>
          <Badge
            tone={mode === 'source' && sourceIssueCount ? 'warning' : 'primary'}
          >
            {mode === 'source' ? 'Source HTML' : 'Visual editor'}
          </Badge>
          <ModeSwitcher
            value={mode}
            onMode={onMode}
            className="editor-mode-switcher"
          />
        </div>
        {showMetrics ? (
          <div
            className="editor-command-metrics"
            aria-label="Draft body metrics"
          >
            <Badge tone="neutral">{formatCount(metrics.words, 'word')}</Badge>
            <Badge tone="neutral" className="editor-command-secondary-metric">
              {formatCount(metrics.chars, 'char')}
            </Badge>
            <Badge tone="neutral">{formatCount(metrics.links, 'link')}</Badge>
            {mode === 'source' ? (
              <>
                <Badge tone={sourceIssueCount ? 'warning' : 'success'}>
                  {sourceIssueCount
                    ? formatCount(sourceIssueCount, 'source issue')
                    : 'Clean source'}
                </Badge>
                <Badge
                  tone="neutral"
                  className="editor-command-secondary-metric"
                >
                  {formatCount(sourceStats.plainTextChars, 'plain-text char')}
                </Badge>
              </>
            ) : (
              <Badge tone={metrics.warnings ? 'warning' : 'success'}>
                {metrics.warnings
                  ? formatCount(metrics.warnings, 'warning')
                  : 'No warnings'}
              </Badge>
            )}
          </div>
        ) : null}
      </div>
      <div className="editor-command-actions">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="secondary-action compact-action"
          aria-label={
            isFocusWorkspace ? 'Exit focus workspace' : 'Focus workspace'
          }
          aria-pressed={isFocusWorkspace}
          onClick={onFocusWorkspace}
        >
          <LaptopMinimal aria-hidden="true" strokeWidth={2.1} />
          <span className="editor-action-label">
            {isFocusWorkspace ? 'Exit focus' : 'Focus workspace'}
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="secondary-action compact-action"
          aria-label="Focus editor"
          onClick={onFocusEditor}
        >
          <PencilLine aria-hidden="true" strokeWidth={2.1} />
          <span className="editor-action-label">Focus editor</span>
        </Button>
      </div>
    </section>
  )
}

function formatCount(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

function WorkflowStrip({
  busy,
  link,
  message,
  messageTone,
  openUrl,
  readiness,
  showControls,
  syncMessage,
  syncStatus,
  themeStyle,
  onConnect,
  onCreateDraft,
  onLoadDrafts,
  onRefresh,
  onUpdateDraft,
}: {
  busy: boolean
  link?: GmailDraftLink
  message: string
  messageTone: MessageTone
  openUrl: string
  readiness: GmailReadinessReport
  showControls: boolean
  syncMessage: string
  syncStatus: GmailAuthStatus
  themeStyle: CSSProperties
  onConnect: () => void
  onCreateDraft: () => void
  onLoadDrafts: () => void
  onRefresh: () => void
  onUpdateDraft: () => void
}) {
  const warningCount = readiness.checks.filter(
    (check) => check.state !== 'pass',
  ).length
  const syncLabel = getGmailWorkflowLabel(syncStatus, link)
  const syncDetail =
    syncMessage ||
    (syncStatus.connected
      ? (syncStatus.email ?? 'Gmail connected.')
      : syncStatus.needsConfig
        ? 'Add OAuth config to enable Gmail sync.'
        : 'Gmail sync is optional.')

  return (
    <section className="workflow-strip" aria-label="Draft workflow">
      <div className="workflow-primary">
        <div className="workflow-title">
          <span className="field-label field-label-inline">
            <FileCode2 aria-hidden="true" size={12} strokeWidth={2.2} />
            Draft
          </span>
          <h2 id="editor-heading" className="field-value">
            Untitled Gmail body
          </h2>
        </div>
        <output
          className={cn('status', `status-${messageTone}`)}
          aria-atomic="true"
          aria-live={messageTone === 'error' ? 'assertive' : 'polite'}
          role={messageTone === 'error' ? 'alert' : 'status'}
        >
          {message}
        </output>
      </div>

      <div className="workflow-gmail" aria-live="polite">
        <span className="field-label field-label-inline">
          <Mail aria-hidden="true" size={12} strokeWidth={2.2} />
          Gmail sync
        </span>
        <div className="workflow-inline">
          <Badge tone={getGmailWorkflowTone(syncStatus, link)}>
            {syncLabel}
          </Badge>
          <span>{syncDetail}</span>
        </div>
      </div>

      {showControls ? (
        <div
          className="workflow-actions"
          role="group"
          aria-label="Gmail sync menu"
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="workflow-connect-action workflow-menu-trigger"
                disabled={busy}
                aria-label={
                  syncStatus.connected
                    ? 'Open Gmail sync menu'
                    : 'Connect Gmail'
                }
              >
                <Mail aria-hidden="true" strokeWidth={2.1} />
                {syncStatus.connected ? 'Gmail' : 'Connect'}
                <MoreHorizontal aria-hidden="true" strokeWidth={2.1} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={themeStyle}>
              <DropdownMenuLabel>Gmail workflow</DropdownMenuLabel>
              {syncStatus.connected ? (
                link?.draftId ? (
                  <>
                    <DropdownMenuItem onSelect={onUpdateDraft}>
                      <RefreshCw aria-hidden="true" strokeWidth={2.1} />
                      Sync linked draft
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={openUrl} target="_blank" rel="noreferrer">
                        <Mail aria-hidden="true" strokeWidth={2.1} />
                        Open in Gmail
                      </a>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={onCreateDraft}>
                      <Mail aria-hidden="true" strokeWidth={2.1} />
                      Create Gmail draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onLoadDrafts}>
                      <RefreshCw aria-hidden="true" strokeWidth={2.1} />
                      Load drafts
                    </DropdownMenuItem>
                  </>
                )
              ) : (
                <>
                  <DropdownMenuItem
                    disabled={syncStatus.needsConfig}
                    onSelect={onConnect}
                  >
                    <Mail aria-hidden="true" strokeWidth={2.1} />
                    Connect Gmail
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onRefresh}>
                    <RefreshCw aria-hidden="true" strokeWidth={2.1} />
                    Refresh status
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="workflow-readiness">
        <span className="field-label field-label-inline">
          <CheckCircle2 aria-hidden="true" size={12} strokeWidth={2.2} />
          Readiness
        </span>
        <div className="workflow-inline">
          <strong>{readiness.status}</strong>
          <Badge
            tone={getReadinessTone(readiness.status)}
            className="readiness-pill"
          >
            {warningCount
              ? `${warningCount} issue${warningCount === 1 ? '' : 's'}`
              : 'Ready to copy'}
          </Badge>
        </div>
      </div>
    </section>
  )
}

function InspectorPanel({
  children,
  collapsed,
  gmailLabel,
  libraryCounts,
  onToggle,
  readinessIssueCount,
  readinessStatus,
}: {
  children: ReactNode
  collapsed: boolean
  gmailLabel: string
  libraryCounts: {
    signatures: number
    templates: number
    variableSets: number
  }
  onToggle: () => void
  readinessIssueCount: number
  readinessStatus: GmailReadinessReport['status']
}) {
  const totalLibraryItems =
    libraryCounts.templates +
    libraryCounts.signatures +
    libraryCounts.variableSets

  return (
    <aside
      className={cn(
        'side-panel floating-inspector',
        collapsed && 'side-panel-collapsed',
      )}
      aria-label="Gmail readiness and preview tools"
    >
      {collapsed ? (
        <button
          type="button"
          className="inspector-rail"
          aria-label="Expand inspector"
          aria-expanded="false"
          aria-controls="inspector-panels"
          onClick={onToggle}
        >
          <PanelRightOpen aria-hidden="true" strokeWidth={2.1} />
          <span className="inspector-rail-label">Inspector</span>
          <span className="inspector-rail-chips" aria-hidden="true">
            <Badge tone="neutral">{gmailLabel}</Badge>
            <Badge tone={getReadinessTone(readinessStatus)}>
              {readinessIssueCount
                ? formatCount(readinessIssueCount, 'issue')
                : 'Ready'}
            </Badge>
            <Badge tone="neutral">{totalLibraryItems} saved</Badge>
          </span>
          <span className="sr-only">
            Gmail {gmailLabel}. {readinessStatus}. {totalLibraryItems} library
            items.
          </span>
        </button>
      ) : (
        <>
          <div className="inspector-toolbar">
            <div>
              <span className="field-label">Inspector</span>
              <strong>Sync and checks</strong>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="icon-button"
              aria-label="Collapse inspector"
              aria-expanded="true"
              aria-controls="inspector-panels"
              onClick={onToggle}
            >
              <PanelRightClose aria-hidden="true" strokeWidth={2.1} />
            </Button>
          </div>
          <div id="inspector-panels" className="inspector-panels">
            {children}
          </div>
        </>
      )}
    </aside>
  )
}

function GmailPanel({
  busy,
  drafts,
  link,
  message,
  status,
  onDisconnect,
  onLoadDraft,
}: {
  busy: boolean
  drafts: GmailDraftSummary[]
  link?: GmailDraftLink
  message: string
  status: GmailAuthStatus
  onDisconnect: () => void
  onLoadDraft: (id: string) => void
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
      <p aria-live="polite" role="status">
        {message || 'Connect Gmail only if you want draft sync.'}
      </p>
      {status.connected ? (
        <div className="gmail-actions">
          <span className="local-badge">
            {status.email ?? 'Gmail connected'}
          </span>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={busy}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : null}
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
  busy,
  conflict,
  onCancel,
  onOverwrite,
  onReplaceLocal,
  onSaveNew,
}: {
  busy: boolean
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
      aria-busy={busy}
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
          disabled={busy}
          onClick={onReplaceLocal}
        >
          Replace local
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={busy}
          onClick={onOverwrite}
        >
          Overwrite Gmail
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={busy}
          onClick={onSaveNew}
        >
          Save new version
        </button>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={busy}
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
  const isLibraryEmpty =
    library.templates.length === 0 &&
    library.signatures.length === 0 &&
    library.variableSets.length === 0

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
      {isLibraryEmpty ? (
        <>
          <div className="library-empty-state">
            <strong>No saved library items</strong>
            <p>
              Save this draft as a template, import a bundle, or bring in Gmail
              signatures after sync is enabled.
            </p>
          </div>
          <div className="gmail-actions library-empty-actions">
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
              onClick={onAddSignature}
            >
              Add signature
            </button>
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={onSaveVariableSet}
            >
              Add variables
            </button>
            <button
              type="button"
              className="secondary-action compact-action"
              onClick={onImportLibrary}
            >
              Import bundle
            </button>
            <button
              type="button"
              className="secondary-action compact-action"
              disabled={busy}
              onClick={onImportGmailSignatures}
            >
              {canImportGmailSignatures
                ? 'Import Gmail'
                : 'Enable Gmail import'}
            </button>
          </div>
          {message ? (
            <p className="library-message" aria-live="polite" role="status">
              {message}
            </p>
          ) : null}
        </>
      ) : (
        <>
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
              {canImportGmailSignatures
                ? 'Import Gmail'
                : 'Enable Gmail import'}
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
          {message ? (
            <p className="library-message" aria-live="polite" role="status">
              {message}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

type ThemeToggleOption = {
  Icon: LucideIcon
  label: string
  mode: ThemePreference
}

const THEME_TOGGLE_OPTIONS: readonly ThemeToggleOption[] = [
  { Icon: Sun, label: 'Light', mode: 'light' },
  { Icon: Moon, label: 'Dark', mode: 'dark' },
  { Icon: LaptopMinimal, label: 'Auto', mode: 'system' },
  { Icon: Palette, label: 'Custom', mode: 'custom' },
]

function ThemePreferenceToggle({
  preference,
  onPreference,
  includeCustom = false,
  className,
  ariaLabel,
}: {
  preference: ThemePreference
  onPreference: (preference: ThemePreference) => void
  includeCustom?: boolean
  className: string
  ariaLabel: string
}) {
  const activePreference = preference === 'custom' ? 'system' : preference
  const value = includeCustom ? preference : activePreference
  const options = includeCustom
    ? THEME_TOGGLE_OPTIONS
    : THEME_TOGGLE_OPTIONS.filter((option) => option.mode !== 'custom')

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextPreference) => {
        if (nextPreference) {
          onPreference(nextPreference as ThemePreference)
        }
      }}
      className={className}
      aria-label={ariaLabel}
    >
      {options.map(({ Icon, label, mode }) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          aria-label={`Use ${label.toLowerCase()} theme`}
        >
          <Icon aria-hidden="true" strokeWidth={2.1} />
          <span className="theme-option-label">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function ThemeSwitcher({
  hasCustomTheme,
  preference,
  themeStyle,
  onPreference,
}: {
  hasCustomTheme: boolean
  preference: ThemePreference
  themeStyle: CSSProperties
  onPreference: (preference: ThemePreference) => void
}) {
  const activePreference =
    preference === 'custom' && !hasCustomTheme ? 'system' : preference
  const activeOption =
    THEME_TOGGLE_OPTIONS.find((option) => option.mode === activePreference) ??
    THEME_TOGGLE_OPTIONS[2]
  const ActiveIcon = activeOption.Icon
  const options = hasCustomTheme
    ? THEME_TOGGLE_OPTIONS
    : THEME_TOGGLE_OPTIONS.filter((option) => option.mode !== 'custom')

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="theme-menu-trigger"
          aria-label={`Theme preference: ${activeOption.label}`}
          title={`Theme: ${activeOption.label}`}
        >
          <ActiveIcon aria-hidden="true" strokeWidth={2.1} />
          <span className="sr-only">{activeOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="theme-menu-panel" style={themeStyle}>
        <DropdownMenuLabel>Theme preference</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={activePreference}
          onValueChange={(nextPreference) => {
            onPreference(nextPreference as ThemePreference)
          }}
        >
          {options.map(({ Icon, label, mode }) => (
            <DropdownMenuRadioItem key={mode} value={mode}>
              <Icon aria-hidden="true" strokeWidth={2.1} />
              <span>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModeSwitcher({
  className,
  onMode,
  value,
}: {
  className?: string
  onMode: (mode: EditorMode) => void
  value: EditorMode
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextMode) => {
        if (nextMode) {
          onMode(nextMode as EditorMode)
        }
      }}
      className={cn('mode-switcher', className)}
      aria-label="Editor mode"
    >
      {(['visual', 'source'] as const).map((mode) => (
        <ToggleGroupItem key={mode} value={mode}>
          {mode === 'visual' ? (
            <PencilLine aria-hidden="true" size={15} strokeWidth={2.1} />
          ) : (
            <FileCode2 aria-hidden="true" size={15} strokeWidth={2.1} />
          )}
          {mode === 'visual' ? 'Visual' : 'Source'}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
        <Badge
          tone={getReadinessTone(report.status)}
          className="readiness-pill"
        >
          {report.status}
        </Badge>
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

function getReadinessTone(
  status: GmailReadinessReport['status'],
): 'success' | 'warning' | 'error' {
  if (status === 'Ready') {
    return 'success'
  }

  return status === 'Copy blocked' ? 'error' : 'warning'
}

function getGmailWorkflowLabel(
  status: GmailAuthStatus,
  link?: GmailDraftLink,
): string {
  if (link?.status) {
    return link.status
  }

  if (status.connected) {
    return 'connected'
  }

  return status.needsConfig ? 'setup needed' : 'local only'
}

function getGmailWorkflowTone(
  status: GmailAuthStatus,
  link?: GmailDraftLink,
): 'neutral' | 'primary' | 'success' | 'warning' | 'error' {
  if (link?.status === 'error' || link?.status === 'conflict') {
    return 'error'
  }

  if (link?.status === 'pending' || link?.status === 'paused') {
    return 'warning'
  }

  if (link?.status === 'synced' || status.connected) {
    return 'success'
  }

  return status.needsConfig ? 'warning' : 'neutral'
}

function PreviewDrawer({
  closeButtonRef,
  html,
  mode,
  readiness,
  sourceHtml,
  text,
  themeStyle,
  onClose,
  onMode,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>
  html: string
  mode: PreviewMode
  readiness: GmailReadinessReport
  sourceHtml: string
  text: string
  themeStyle: CSSProperties
  onClose: () => void
  onMode: (mode: PreviewMode) => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPortal>
        <section
          className="preview-drawer"
          aria-label="Gmail body preview"
          style={themeStyle}
        >
          <DialogOverlay />
          <DialogContent
            aria-label="Gmail body preview"
            className="preview-panel"
          >
            <div className="preview-header">
              <div>
                <span className="eyebrow">Sanitized preview</span>
                <DialogTitle id="preview-heading">
                  Gmail body preview
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preview the sanitized Gmail body in rendered, plain text, or
                  source modes before copying.
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <Button
                  ref={closeButtonRef}
                  type="button"
                  variant="secondary"
                  className="icon-button"
                >
                  Close
                </Button>
              </DialogClose>
            </div>
            <ToggleGroup
              type="single"
              value={mode}
              className="preview-tabs"
              aria-label="Preview mode"
              onValueChange={(nextMode) => {
                if (nextMode) {
                  onMode(nextMode as PreviewMode)
                }
              }}
            >
              {(['rendered', 'plain', 'source'] as const).map((previewMode) => (
                <ToggleGroupItem key={previewMode} value={previewMode}>
                  {previewMode === 'rendered' ? (
                    <Eye aria-hidden="true" strokeWidth={2.1} />
                  ) : previewMode === 'plain' ? (
                    <Type aria-hidden="true" strokeWidth={2.1} />
                  ) : (
                    <FileCode2 aria-hidden="true" strokeWidth={2.1} />
                  )}
                  {previewMode === 'rendered'
                    ? 'Rendered'
                    : previewMode === 'plain'
                      ? 'Plain text'
                      : 'Source'}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="preview-meta">
              <Badge tone="neutral">
                {readiness.linkCount} link
                {readiness.linkCount === 1 ? '' : 's'}
              </Badge>
              <Badge tone="neutral">{text.length} plain-text chars</Badge>
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
          </DialogContent>
        </section>
      </DialogPortal>
    </Dialog>
  )
}

function SettingsModal({
  activeTheme,
  closeButtonRef,
  settings,
  themeStyle,
  themeJsonDraft,
  themeJsonError,
  onApplyThemeJson,
  onClose,
  onCopyThemeJson,
  onPresetTheme,
  onResetSettings,
  onSettings,
  onThemeJsonDraft,
  onThemePreference,
}: {
  activeTheme: ThemeDefinition
  closeButtonRef: RefObject<HTMLButtonElement | null>
  settings: AppSettings
  themeStyle: CSSProperties
  themeJsonDraft: string
  themeJsonError: string
  onApplyThemeJson: () => void
  onClose: () => void
  onCopyThemeJson: () => void
  onPresetTheme: (theme: ThemeDefinition) => void
  onResetSettings: () => void
  onSettings: (patch: Partial<AppSettings>) => void
  onThemeJsonDraft: (value: string) => void
  onThemePreference: (preference: ThemePreference) => void
}) {
  const shouldOpenAdvancedTheme = Boolean(
    themeJsonError || settings.themePreference === 'custom',
  )
  const [isAdvancedThemeOpen, setAdvancedThemeOpen] = useState(false)
  const advancedThemeOpen = isAdvancedThemeOpen || shouldOpenAdvancedTheme
  const [themePresetQuery, setThemePresetQuery] = useState('')
  const [themePresetCategory, setThemePresetCategory] = useState<
    ThemePresetCategory | 'All'
  >('All')
  const visibleLightPresets = searchThemePresets(
    themePresetQuery,
    'light',
    themePresetCategory,
  )
  const visibleDarkPresets = searchThemePresets(
    themePresetQuery,
    'dark',
    themePresetCategory,
  )
  const visiblePresetCount =
    visibleLightPresets.length + visibleDarkPresets.length

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPortal>
        <section
          className="settings-layer"
          aria-label="Settings"
          style={themeStyle}
        >
          <DialogOverlay />
          <DialogContent aria-label="Settings" className="settings-panel">
            <div className="preview-header">
              <div>
                <span className="eyebrow">Studio controls</span>
                <DialogTitle id="settings-heading">Settings</DialogTitle>
                <DialogDescription className="sr-only">
                  Adjust local appearance, editor preferences, privacy defaults,
                  and custom theme tokens.
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <Button
                  ref={closeButtonRef}
                  type="button"
                  variant="secondary"
                  className="icon-button"
                >
                  Close
                </Button>
              </DialogClose>
            </div>

            <div className="settings-grid">
              <div className="settings-column">
                <section className="settings-section">
                  <h3>Appearance</h3>
                  <p>
                    Theme changes stay local. Pick a bundled preset here, or use
                    the advanced JSON editor below when you need custom tokens.
                  </p>
                  <div className="active-theme-summary">
                    <span
                      style={{
                        background: activeTheme.tokens.background,
                        borderColor: activeTheme.tokens.lineStrong,
                        color: activeTheme.tokens.ink,
                      }}
                    >
                      Aa
                    </span>
                    <div>
                      <strong>{activeTheme.name}</strong>
                      <small>{activeTheme.mode} mode active</small>
                    </div>
                  </div>
                  <ThemePreferenceToggle
                    preference={settings.themePreference}
                    onPreference={onThemePreference}
                    includeCustom
                    className="theme-mode-grid"
                    ariaLabel="Theme preference"
                  />
                  <div className="theme-preset-toolbar">
                    <label className="theme-search-field">
                      <Search aria-hidden="true" size={15} strokeWidth={2.1} />
                      <span className="sr-only">Search style presets</span>
                      <input
                        type="search"
                        value={themePresetQuery}
                        onChange={(event) =>
                          setThemePresetQuery(event.target.value)
                        }
                        placeholder="Search styles, colors, contrast"
                        aria-label="Search style presets"
                      />
                    </label>
                    <span className="theme-index-count">
                      {visiblePresetCount} / {THEME_PRESETS.length}
                    </span>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={themePresetCategory}
                    onValueChange={(nextCategory) => {
                      if (nextCategory) {
                        setThemePresetCategory(
                          nextCategory as ThemePresetCategory | 'All',
                        )
                      }
                    }}
                    className="theme-category-filter"
                    aria-label="Style preset category"
                  >
                    {(['All', ...THEME_PRESET_CATEGORIES] as const).map(
                      (category) => (
                        <ToggleGroupItem
                          key={category}
                          value={category}
                          aria-label={`Show ${category.toLowerCase()} presets`}
                        >
                          {category}
                        </ToggleGroupItem>
                      ),
                    )}
                  </ToggleGroup>
                  <ThemePresetSection
                    activeTheme={activeTheme}
                    title="Light presets"
                    themes={visibleLightPresets}
                    onPresetTheme={onPresetTheme}
                  />
                  <ThemePresetSection
                    activeTheme={activeTheme}
                    title="Dark presets"
                    themes={visibleDarkPresets}
                    onPresetTheme={onPresetTheme}
                  />
                </section>
              </div>

              <div className="settings-column settings-column-secondary">
                <details
                  className="settings-section settings-section-advanced"
                  open={advancedThemeOpen}
                  onToggle={(event) =>
                    setAdvancedThemeOpen(event.currentTarget.open)
                  }
                >
                  <summary>Advanced Theme JSON</summary>
                  <p>
                    Copy, paste, validate, and apply a local theme token object.
                    This stays separate from the daily composing flow.
                  </p>
                  <label className="field-label" htmlFor="theme-json">
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="secondary-action compact-action"
                      onClick={onApplyThemeJson}
                    >
                      Apply JSON
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="secondary-action compact-action"
                      onClick={onCopyThemeJson}
                    >
                      Copy current JSON
                    </Button>
                  </div>
                </details>

                <section className="settings-section settings-section-workspace">
                  <h3>Workspace</h3>
                  <p>
                    Tune the composing surface without changing draft, Gmail, or
                    library data.
                  </p>
                  <SettingsChoiceGroup<InspectorDefault>
                    label="Inspector default"
                    value={settings.inspectorDefault}
                    options={[
                      ['auto', 'Auto'],
                      ['expanded', 'Expanded'],
                      ['collapsed', 'Collapsed'],
                    ]}
                    onValueChange={(inspectorDefault) =>
                      onSettings({ inspectorDefault })
                    }
                  />
                  <SettingsChoiceGroup<EditorCanvasSize>
                    label="Editor canvas"
                    value={settings.editorCanvas}
                    options={[
                      ['compact', 'Compact'],
                      ['comfortable', 'Comfortable'],
                      ['wide', 'Wide'],
                    ]}
                    onValueChange={(editorCanvas) =>
                      onSettings({ editorCanvas })
                    }
                  />
                  <SettingsChoiceGroup<DefaultPreviewMode>
                    label="Default preview mode"
                    value={settings.defaultPreviewMode}
                    options={[
                      ['rendered', 'Rendered'],
                      ['plain', 'Plain text'],
                      ['source', 'Source'],
                    ]}
                    onValueChange={(defaultPreviewMode) =>
                      onSettings({ defaultPreviewMode })
                    }
                  />
                  <label className="toggle-row">
                    <span>Focus editor on launch</span>
                    <input
                      type="checkbox"
                      checked={settings.focusEditorOnLaunch}
                      onChange={(event) =>
                        onSettings({
                          focusEditorOnLaunch: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="toggle-row">
                    <span>Show editor metrics</span>
                    <input
                      type="checkbox"
                      checked={settings.showEditorMetrics}
                      onChange={(event) =>
                        onSettings({ showEditorMetrics: event.target.checked })
                      }
                    />
                  </label>
                  <label className="toggle-row">
                    <span>Keep Gmail controls visible</span>
                    <input
                      type="checkbox"
                      checked={settings.keepGmailControlsVisible}
                      onChange={(event) =>
                        onSettings({
                          keepGmailControlsVisible: event.target.checked,
                        })
                      }
                    />
                  </label>
                </section>

                <section className="settings-section settings-section-privacy">
                  <h3>Editor and privacy</h3>
                  <label className="toggle-row">
                    <span>Open in Source mode by default</span>
                    <input
                      type="checkbox"
                      checked={settings.editorMode === 'source'}
                      onChange={(event) =>
                        onSettings({
                          editorMode: event.target.checked
                            ? 'source'
                            : 'visual',
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
                        onSettings({
                          clipboardPrivacyReminder: event.target.checked,
                        })
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="secondary-action compact-action"
                    onClick={onResetSettings}
                  >
                    Reset settings
                  </Button>
                </section>
              </div>
            </div>
          </DialogContent>
        </section>
      </DialogPortal>
    </Dialog>
  )
}

function SettingsChoiceGroup<TValue extends string>({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string
  onValueChange: (value: TValue) => void
  options: readonly (readonly [TValue, string])[]
  value: TValue
}) {
  return (
    <div className="settings-choice">
      <span className="field-label">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        className="settings-choice-control"
        aria-label={label}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(nextValue as TValue)
          }
        }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <ToggleGroupItem key={optionValue} value={optionValue}>
            {optionLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function ThemePresetSection({
  activeTheme,
  themes,
  title,
  onPresetTheme,
}: {
  activeTheme: ThemeDefinition
  themes: ThemeDefinition[]
  title: string
  onPresetTheme: (theme: ThemeDefinition) => void
}) {
  const groups = groupThemePresets(themes)

  return (
    <section className="theme-preset-section" aria-label={title}>
      <div className="theme-preset-section-header">
        <span className="settings-subhead">{title}</span>
        <span className="theme-index-count">{themes.length}</span>
      </div>
      {themes.length ? (
        <div className="theme-preset-groups">
          {groups.map(({ category, groupedThemes }) => (
            <div key={category} className="theme-preset-group">
              <div className="theme-preset-group-header">
                <span>{category}</span>
                <span>{groupedThemes.length}</span>
              </div>
              <div className="theme-preset-grid">
                {groupedThemes.map((theme) => {
                  const index = getThemePresetIndexEntry(theme.id)

                  return (
                    <Button
                      key={theme.id}
                      type="button"
                      variant="secondary"
                      className="theme-card"
                      aria-pressed={activeTheme.id === theme.id}
                      onClick={() => onPresetTheme(theme)}
                    >
                      <span
                        style={{
                          background: theme.tokens.background,
                          borderColor: theme.tokens.lineStrong,
                          color: theme.tokens.ink,
                        }}
                      >
                        Aa
                      </span>
                      <span className="theme-card-copy">
                        <strong>{theme.name}</strong>
                        <small>{index?.category ?? theme.mode}</small>
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="theme-preset-empty">No presets match this search.</p>
      )}
    </section>
  )
}

function groupThemePresets(themes: ThemeDefinition[]) {
  return THEME_PRESET_CATEGORIES.map((category) => ({
    category,
    groupedThemes: themes.filter(
      (theme) => getThemePresetIndexEntry(theme.id)?.category === category,
    ),
  })).filter((group) => group.groupedThemes.length > 0)
}

function ConfirmDialog({
  dialog,
  isSubmitting,
  themeStyle,
  onClose,
  onConfirm,
}: {
  dialog: ConfirmDialogState
  isSubmitting: boolean
  themeStyle: CSSProperties
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose()
      }}
    >
      <AlertDialogPortal>
        <section className="app-dialog-layer" style={themeStyle}>
          <AlertDialogOverlay />
          <AlertDialogContent
            aria-busy={isSubmitting}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
            }}
          >
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.description}
            </AlertDialogDescription>
            {isSubmitting ? (
              <p className="sr-only" role="status">
                Working...
              </p>
            ) : null}
            <div className="dialog-actions">
              <AlertDialogCancel asChild>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </AlertDialogCancel>
              <Button
                type="button"
                variant="primary"
                disabled={isSubmitting}
                onClick={onConfirm}
              >
                {isSubmitting ? 'Working...' : dialog.confirmLabel}
              </Button>
            </div>
          </AlertDialogContent>
        </section>
      </AlertDialogPortal>
    </AlertDialog>
  )
}

function FormDialog({
  dialog,
  isSubmitting,
  themeStyle,
  onChangeField,
  onClose,
  onSubmit,
}: {
  dialog: FormDialogState
  isSubmitting: boolean
  themeStyle: CSSProperties
  onChangeField: (fieldId: string, value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose()
      }}
    >
      <DialogPortal>
        <section className="app-dialog-layer" style={themeStyle}>
          <DialogOverlay />
          <DialogContent
            className="form-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
              aria-busy={isSubmitting}
            >
              <div className="dialog-heading">
                <DialogTitle>{dialog.title}</DialogTitle>
                <DialogDescription>{dialog.description}</DialogDescription>
              </div>
              <div className="dialog-field-list">
                {dialog.fields.map((field) => (
                  <label key={field.id} className="dialog-field">
                    <span className="field-label">{field.label}</span>
                    {field.kind === 'textarea' ? (
                      <textarea
                        value={field.value}
                        placeholder={field.placeholder}
                        rows={field.rows ?? 6}
                        disabled={isSubmitting}
                        onChange={(event) =>
                          onChangeField(field.id, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.value}
                        placeholder={field.placeholder}
                        disabled={isSubmitting}
                        onChange={(event) =>
                          onChangeField(field.id, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              {dialog.error ? (
                <p className="settings-error" role="alert">
                  {dialog.error}
                </p>
              ) : null}
              <div className="dialog-actions">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Working...' : dialog.submitLabel}
                </Button>
              </div>
            </form>
          </DialogContent>
        </section>
      </DialogPortal>
    </Dialog>
  )
}

function getActiveHTMLElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
}

function getNarrowInspectorViewport(): boolean {
  try {
    return window.matchMedia?.('(max-width: 1180px)').matches ?? false
  } catch {
    return false
  }
}

function getCompactComposerViewport(): boolean {
  try {
    return window.matchMedia?.('(max-width: 760px)').matches ?? false
  } catch {
    return false
  }
}

function getRecipientCount(recipients: DraftRecipients): number {
  return [
    ...normalizeRecipientList(recipients.to),
    ...normalizeRecipientList(recipients.cc),
    ...normalizeRecipientList(recipients.bcc),
  ].length
}

function restoreFocus(
  ref: RefObject<HTMLElement | null>,
  fallbackRef?: RefObject<HTMLElement | null>,
) {
  const target = ref.current?.isConnected ? ref.current : fallbackRef?.current
  ref.current = null
  if (fallbackRef) {
    fallbackRef.current = null
  }

  if (!target?.isConnected) {
    return
  }

  window.requestAnimationFrame(() => target.focus())
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

function collectPlaceholderFields(
  template: EmailTemplate,
  defaults: Record<string, string>,
): FormDialogField[] {
  const names = collectTemplateVariables({
    html: template.html,
    recipients: template.recipients,
    subject: template.subject,
  })
  const variables = new Map(
    template.variables.map((variable) => [variable.name, variable]),
  )

  return names.map((name) => {
    const variable = variables.get(name)
    const fallback = defaults[name] ?? variable?.defaultValue ?? ''
    const label = variable?.label ?? name
    return {
      id: name,
      kind: 'text',
      label: `Value for {{${label}}}`,
      value: fallback,
    }
  })
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
