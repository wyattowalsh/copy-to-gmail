import { sanitizeEmailBodyHtml, stripHtml } from './clipboard'
import { normalizeRecipientList, type LocalDraft } from './drafts'

export async function fingerprintDraft(draft: LocalDraft): Promise<string> {
  const payload = JSON.stringify({
    bcc: normalizeRecipientList(draft.recipients.bcc),
    cc: normalizeRecipientList(draft.recipients.cc),
    html: sanitizeEmailBodyHtml(draft.html).replace(/\s+/g, ' ').trim(),
    selectedSignatureId: draft.selectedSignatureId ?? '',
    selectedTemplateId: draft.selectedTemplateId ?? '',
    subject: draft.subject.trim(),
    text: (draft.text || stripHtml(draft.html)).replace(/\s+/g, ' ').trim(),
    to: normalizeRecipientList(draft.recipients.to),
  })
  const bytes = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
