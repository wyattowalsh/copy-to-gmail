import type { LocalDraft } from './drafts'
import type { EmailSignature } from './signatures'

export type GmailAuthStatus = {
  connected: boolean
  email?: string
  scopes: string[]
  needsConfig?: boolean
  error?: string
}

export type GmailDraftSummary = {
  id: string
  messageId?: string
  subject: string
  updatedAt?: string
  snippet?: string
}

export type GmailDraftResponse = {
  draft: LocalDraft
  fingerprint: string
}

export class GmailConflictError extends Error {
  remoteDraft: LocalDraft
  remoteFingerprint: string

  constructor(
    message: string,
    remoteDraft: LocalDraft,
    remoteFingerprint: string,
  ) {
    super(message)
    this.name = 'GmailConflictError'
    this.remoteDraft = remoteDraft
    this.remoteFingerprint = remoteFingerprint
  }
}

export async function getGmailStatus(): Promise<GmailAuthStatus> {
  return normalizeGmailAuthStatus(
    await apiJson<Partial<GmailAuthStatus>>('/api/gmail/status'),
  )
}

export async function disconnectGmail(): Promise<GmailAuthStatus> {
  return normalizeGmailAuthStatus(
    await apiJson<Partial<GmailAuthStatus>>('/api/gmail/disconnect', {
      method: 'POST',
    }),
  )
}

export async function listGmailDrafts(): Promise<GmailDraftSummary[]> {
  const response = await apiJson<{ drafts: GmailDraftSummary[] }>(
    '/api/gmail/drafts',
  )
  return response.drafts
}

export async function loadGmailDraft(id: string): Promise<GmailDraftResponse> {
  return apiJson<GmailDraftResponse>(
    `/api/gmail/drafts/${encodeURIComponent(id)}`,
  )
}

export async function createGmailDraft(
  draft: LocalDraft,
): Promise<GmailDraftResponse> {
  return apiJson<GmailDraftResponse>('/api/gmail/drafts', {
    body: JSON.stringify({ draft }),
    method: 'POST',
  })
}

export async function updateGmailDraft(
  draftId: string,
  draft: LocalDraft,
  options: { expectedFingerprint?: string } = {},
): Promise<GmailDraftResponse> {
  return apiJson<GmailDraftResponse>(
    `/api/gmail/drafts/${encodeURIComponent(draftId)}`,
    {
      body: JSON.stringify({
        draft,
        expectedFingerprint: options.expectedFingerprint,
      }),
      method: 'PUT',
    },
  )
}

export async function importGmailSignatures(): Promise<EmailSignature[]> {
  const response = await apiJson<{ signatures: EmailSignature[] }>(
    '/api/gmail/signatures',
  )
  return response.signatures
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const data = (await response.json().catch(() => ({}))) as unknown

  if (!response.ok) {
    if (response.status === 409 && isConflictPayload(data)) {
      throw new GmailConflictError(
        data.error,
        data.remoteDraft,
        data.remoteFingerprint,
      )
    }

    const message =
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Gmail request failed with HTTP ${response.status}.`
    throw new Error(message)
  }

  return data as T
}

function normalizeGmailAuthStatus(
  status: Partial<GmailAuthStatus>,
): GmailAuthStatus {
  return {
    connected: Boolean(status.connected),
    email: status.email,
    error: status.error,
    needsConfig: status.needsConfig,
    scopes: Array.isArray(status.scopes) ? status.scopes : [],
  }
}

function isConflictPayload(value: unknown): value is {
  error: string
  remoteDraft: LocalDraft
  remoteFingerprint: string
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string' &&
    typeof (value as { remoteFingerprint?: unknown }).remoteFingerprint ===
      'string' &&
    typeof (value as { remoteDraft?: unknown }).remoteDraft === 'object' &&
    (value as { remoteDraft?: unknown }).remoteDraft !== null
  )
}
