import { analyzeEmailBody } from './emailSafety'
import { findInvalidRecipients, type DraftRecipients } from './drafts'

export type GmailReadinessState = 'pass' | 'warn' | 'fail'

export type GmailReadinessCheck = {
  id: string
  label: string
  detail: string
  state: GmailReadinessState
}

export type GmailReadinessReport = {
  status: 'Ready' | 'Needs review' | 'Copy blocked'
  checks: GmailReadinessCheck[]
  html: string
  text: string
  linkCount: number
}

export type GmailReadinessInput = {
  html?: string
  recipients?: DraftRecipients
  subject?: string
  text?: string
  hasClipboardApi?: boolean
  hasFallbackCopy?: boolean
  hasRichClipboard?: boolean
}

export function analyzeGmailReadiness(
  input: GmailReadinessInput,
): GmailReadinessReport {
  const analysis = analyzeEmailBody(input.html ?? '')
  const invalidRecipients = input.recipients
    ? findInvalidRecipients(input.recipients)
    : []
  const checks: GmailReadinessCheck[] = [
    {
      id: 'editor-content',
      label: 'Editor content',
      detail: analysis.html
        ? 'Body HTML is ready to copy.'
        : 'Start writing before copying.',
      state: analysis.html ? 'pass' : 'warn',
    },
    {
      id: 'rich-clipboard',
      label: 'Rich clipboard',
      detail: input.hasRichClipboard
        ? 'Browser can write HTML and plain text together.'
        : 'Rich clipboard is unavailable; use preview or plain text fallback.',
      state: input.hasRichClipboard ? 'pass' : 'warn',
    },
    {
      id: 'copy-path',
      label: 'Copy path',
      detail: input.hasRichClipboard
        ? 'Rich clipboard copy is available after a click.'
        : input.hasFallbackCopy
          ? 'Rich clipboard is unavailable, but the sanitized fallback copy path may work.'
          : 'No browser copy path is available; use the preview drawer and copy manually.',
      state: input.hasRichClipboard
        ? 'pass'
        : input.hasFallbackCopy
          ? 'warn'
          : 'fail',
    },
    {
      id: 'subject-line',
      label: 'Subject',
      detail: input.subject?.trim()
        ? 'Subject will be included in draft JSON and Gmail draft sync.'
        : 'Subject is empty; Gmail allows this, but it is easy to miss later.',
      state: input.subject?.trim() ? 'pass' : 'warn',
    },
    {
      id: 'recipients',
      label: 'Recipients',
      detail: invalidRecipients.length
        ? `${invalidRecipients.length} recipient value needs review before Gmail sync.`
        : input.recipients &&
            (input.recipients.to || input.recipients.cc || input.recipients.bcc)
          ? 'Recipient fields look ready for Gmail.'
          : 'No recipients yet; local copy can continue without them.',
      state: invalidRecipients.length ? 'warn' : 'pass',
    },
    {
      id: 'safe-links',
      label: 'Safe links',
      detail: analysis.unsafeLinks.length
        ? `${analysis.unsafeLinks.length} unsafe link was removed or needs review.`
        : analysis.links.length
          ? `${analysis.links.length} link${analysis.links.length === 1 ? '' : 's'} ready for Gmail.`
          : 'No links detected.',
      state: analysis.unsafeLinks.length ? 'warn' : 'pass',
    },
    {
      id: 'gmail-mode',
      label: 'Gmail paste mode',
      detail: 'Paste into Gmail compose with Plain text mode off.',
      state: 'warn',
    },
  ]

  const status = checks.some((check) => check.state === 'fail')
    ? 'Copy blocked'
    : checks.some((check) => check.state === 'warn')
      ? 'Needs review'
      : 'Ready'

  return {
    status,
    checks,
    html: analysis.html,
    text: input.text?.trim() || analysis.text,
    linkCount: analysis.links.length,
  }
}

export function getClipboardCapabilities(): Pick<
  GmailReadinessInput,
  'hasClipboardApi' | 'hasFallbackCopy' | 'hasRichClipboard'
> {
  const clipboard = navigator.clipboard
  const clipboardItem = window.ClipboardItem
  const clipboardWrite = clipboard
    ? (Reflect.get(clipboard, 'write') as unknown)
    : undefined
  const clipboardItemSupports = clipboardItem
    ? (Reflect.get(clipboardItem, 'supports') as unknown)
    : undefined
  const hasClipboardApi = typeof clipboardWrite === 'function'
  const hasFallbackCopy = typeof document.execCommand === 'function'
  const supportsHtml =
    typeof clipboardItemSupports !== 'function' ||
    clipboardItemSupports.call(clipboardItem, 'text/html') === true
  const hasRichClipboard = Boolean(
    clipboardItem && hasClipboardApi && supportsHtml,
  )

  return { hasClipboardApi, hasFallbackCopy, hasRichClipboard }
}
