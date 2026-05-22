import { createHash } from 'node:crypto'

const gmailApiBase = 'https://gmail.googleapis.com/gmail/v1/users/me'

export async function listDrafts(accessToken) {
  const list = await gmailFetch(accessToken, '/drafts?maxResults=20')
  const drafts = Array.isArray(list.drafts) ? list.drafts : []
  const hydrated = await Promise.all(
    drafts.map(async (draft) => {
      const full = await gmailFetch(
        accessToken,
        `/drafts/${encodeURIComponent(draft.id)}?format=metadata`,
      )
      const headers = full.message?.payload?.headers ?? []
      return {
        id: full.id,
        messageId: full.message?.id,
        snippet: full.message?.snippet ?? '',
        subject: getHeader(headers, 'subject') || '(no subject)',
        updatedAt: full.message?.internalDate
          ? new Date(Number(full.message.internalDate)).toISOString()
          : undefined,
      }
    }),
  )
  return hydrated
}

export async function getDraft(accessToken, draftId) {
  const data = await gmailFetch(
    accessToken,
    `/drafts/${encodeURIComponent(draftId)}?format=full`,
  )
  return draftFromGmailDraft(data)
}

export async function createDraft(accessToken, draft) {
  const data = await gmailFetch(accessToken, '/drafts', {
    body: JSON.stringify({ message: { raw: encodeMimeDraft(draft) } }),
    method: 'POST',
  })
  return syncedSubmittedDraft(data, draft)
}

export async function updateDraft(accessToken, draftId, draft) {
  const data = await gmailFetch(
    accessToken,
    `/drafts/${encodeURIComponent(draftId)}`,
    {
      body: JSON.stringify({
        id: draftId,
        message: { raw: encodeMimeDraft(draft) },
      }),
      method: 'PUT',
    },
  )
  return syncedSubmittedDraft(data, draft)
}

export async function listSignatures(accessToken) {
  const data = await gmailFetch(accessToken, '/settings/sendAs')
  const sendAs = Array.isArray(data.sendAs) ? data.sendAs : []

  return sendAs
    .filter((identity) => String(identity.signature ?? '').trim())
    .map((identity) => ({
      id: `gmail:${identity.sendAsEmail}`,
      email: identity.sendAsEmail,
      html: identity.signature,
      name: identity.displayName || identity.sendAsEmail || 'Gmail signature',
      source: 'gmail',
      updatedAt: new Date().toISOString(),
    }))
}

export function fingerprintDraft(draft) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        html: String(draft.html ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
        recipients: draft.recipients ?? {},
        selectedSignatureId: draft.selectedSignatureId ?? '',
        selectedTemplateId: draft.selectedTemplateId ?? '',
        subject: String(draft.subject ?? '').trim(),
        text: String(draft.text ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
      }),
    )
    .digest('hex')
}

function draftFromGmailDraft(data) {
  const message = data.message ?? {}
  const payload = message.payload ?? {}
  const headers = payload.headers ?? []
  const html = extractBodyPart(payload, 'text/html') ?? ''
  const text = extractBodyPart(payload, 'text/plain') ?? ''
  const draft = {
    version: 2,
    subject: getHeader(headers, 'subject'),
    recipients: {
      bcc: getHeader(headers, 'bcc'),
      cc: getHeader(headers, 'cc'),
      to: getHeader(headers, 'to'),
    },
    html: html || textToHtml(text),
    text,
    sourceHtml: html || textToHtml(text),
    gmail: {
      accountEmail: '',
      draftId: data.id,
      lastSyncedFingerprint: '',
      messageId: message.id,
      status: 'synced',
      updatedAt: new Date().toISOString(),
    },
  }
  const fingerprint = fingerprintDraft(draft)
  draft.gmail.lastSyncedFingerprint = fingerprint

  return { draft, fingerprint }
}

function syncedSubmittedDraft(data, submittedDraft) {
  const fingerprint = fingerprintDraft(submittedDraft)

  return {
    draft: {
      ...submittedDraft,
      gmail: {
        accountEmail: '',
        draftId: data.id,
        lastSyncedFingerprint: fingerprint,
        messageId: data.message?.id,
        status: 'synced',
        updatedAt: new Date().toISOString(),
      },
    },
    fingerprint,
  }
}

function encodeMimeDraft(draft) {
  const boundary = `copy-to-gmail-${Date.now().toString(36)}`
  const headers = [
    ['To', draft.recipients?.to],
    ['Cc', draft.recipients?.cc],
    ['Bcc', draft.recipients?.bcc],
    ['Subject', draft.subject],
    ['MIME-Version', '1.0'],
    ['Content-Type', `multipart/alternative; boundary="${boundary}"`],
  ]
    .filter(([, value]) => String(value ?? '').trim())
    .map(([name, value]) => `${name}: ${sanitizeHeader(value)}`)
    .join('\r\n')
  const text = draft.text || stripHtml(draft.html ?? '')
  const html = draft.html ?? ''
  const raw = `${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`
  return Buffer.from(raw)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function gmailFetch(accessToken, path, init = {}) {
  const response = await fetch(`${gmailApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? `Gmail API failed with HTTP ${response.status}.`,
    )
  }

  return data
}

function getHeader(headers, name) {
  const header = headers.find(
    (candidate) => candidate.name?.toLowerCase() === name.toLowerCase(),
  )
  return header?.value ?? ''
}

function extractBodyPart(payload, mimeType) {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  for (const part of payload.parts ?? []) {
    const value = extractBodyPart(part, mimeType)

    if (value) {
      return value
    }
  }

  return ''
}

function decodeBase64Url(value) {
  return Buffer.from(
    value.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8')
}

function sanitizeHeader(value) {
  return String(value ?? '')
    .replace(/[\r\n]/g, ' ')
    .trim()
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textToHtml(value) {
  return String(value ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
