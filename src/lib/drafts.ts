import { sanitizeEmailBodyHtml, stripHtml } from './clipboard'

export type DraftRecipients = {
  to: string
  cc: string
  bcc: string
}

export type GmailSyncStatus =
  | 'unlinked'
  | 'pending'
  | 'synced'
  | 'error'
  | 'paused'
  | 'conflict'

export type GmailDraftLink = {
  draftId: string
  messageId?: string
  accountEmail: string
  lastSyncedFingerprint: string
  status: GmailSyncStatus
  updatedAt: string
}

export type LocalDraft = {
  version: 2
  subject: string
  recipients: DraftRecipients
  html: string
  text: string
  sourceHtml: string
  selectedSignatureId?: string
  selectedTemplateId?: string
  gmail?: GmailDraftLink
}

export type LegacyDraftExport = {
  version?: 1
  html: string
  text?: string
  sourceHtml?: string
  settings?: unknown
}

export type DraftExport = LocalDraft | LegacyDraftExport

export function createLocalDraft(
  patch: Partial<Omit<LocalDraft, 'version' | 'recipients'>> & {
    recipients?: Partial<DraftRecipients>
  } = {},
): LocalDraft {
  const html = sanitizeEmailBodyHtml(patch.html ?? '')
  const text = patch.text?.trim() || stripHtml(html)

  return {
    version: 2,
    subject: patch.subject ?? '',
    recipients: {
      to: patch.recipients?.to ?? '',
      cc: patch.recipients?.cc ?? '',
      bcc: patch.recipients?.bcc ?? '',
    },
    html,
    text,
    sourceHtml: patch.sourceHtml?.trim() || html,
    selectedSignatureId: patch.selectedSignatureId,
    selectedTemplateId: patch.selectedTemplateId,
    gmail: patch.gmail,
  }
}

export function draftFromEditorState(input: {
  html: string
  text?: string
  sourceHtml: string
  subject: string
  recipients: DraftRecipients
  selectedSignatureId?: string
  selectedTemplateId?: string
  gmail?: GmailDraftLink
}): LocalDraft {
  return createLocalDraft(input)
}

export function parseDraftImport(value: unknown): LocalDraft {
  if (!isObject(value)) {
    throw new Error('Draft JSON must be an object.')
  }

  if (value.version === 2) {
    return parseVersion2Draft(value)
  }

  if (typeof value.html === 'string') {
    return createLocalDraft({
      html: value.html,
      text: typeof value.text === 'string' ? value.text : undefined,
      sourceHtml:
        typeof value.sourceHtml === 'string' ? value.sourceHtml : value.html,
    })
  }

  throw new Error(
    'Draft JSON must include a version 2 draft or an html string.',
  )
}

export function serializeDraft(draft: LocalDraft): string {
  return JSON.stringify(draft, null, 2)
}

export function normalizeRecipientList(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean)
}

export function findInvalidRecipients(recipients: DraftRecipients): string[] {
  return [recipients.to, recipients.cc, recipients.bcc]
    .flatMap(normalizeRecipientList)
    .filter((recipient) => !isLikelyEmailAddress(recipient))
}

function parseVersion2Draft(value: Record<string, unknown>): LocalDraft {
  const recipients = isObject(value.recipients) ? value.recipients : {}

  return createLocalDraft({
    subject: typeof value.subject === 'string' ? value.subject : '',
    recipients: {
      to: typeof recipients.to === 'string' ? recipients.to : '',
      cc: typeof recipients.cc === 'string' ? recipients.cc : '',
      bcc: typeof recipients.bcc === 'string' ? recipients.bcc : '',
    },
    html: typeof value.html === 'string' ? value.html : '',
    text: typeof value.text === 'string' ? value.text : undefined,
    sourceHtml:
      typeof value.sourceHtml === 'string' ? value.sourceHtml : undefined,
    selectedSignatureId:
      typeof value.selectedSignatureId === 'string'
        ? value.selectedSignatureId
        : undefined,
    selectedTemplateId:
      typeof value.selectedTemplateId === 'string'
        ? value.selectedTemplateId
        : undefined,
    gmail: parseGmailLink(value.gmail),
  })
}

function parseGmailLink(value: unknown): GmailDraftLink | undefined {
  if (!isObject(value)) {
    return undefined
  }

  if (
    typeof value.draftId !== 'string' ||
    typeof value.accountEmail !== 'string' ||
    typeof value.lastSyncedFingerprint !== 'string'
  ) {
    return undefined
  }

  return {
    draftId: value.draftId,
    messageId:
      typeof value.messageId === 'string' ? value.messageId : undefined,
    accountEmail: value.accountEmail,
    lastSyncedFingerprint: value.lastSyncedFingerprint,
    status: isGmailSyncStatus(value.status) ? value.status : 'synced',
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

function isGmailSyncStatus(value: unknown): value is GmailSyncStatus {
  return (
    value === 'unlinked' ||
    value === 'pending' ||
    value === 'synced' ||
    value === 'error' ||
    value === 'paused' ||
    value === 'conflict'
  )
}

function isLikelyEmailAddress(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
