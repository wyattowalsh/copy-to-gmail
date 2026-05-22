import { sanitizeEmailBodyHtml } from './clipboard'

export type EmailSignature = {
  id: string
  name: string
  html: string
  source: 'local' | 'gmail'
  email?: string
  updatedAt: string
}

export function createLocalSignature(input: {
  id: string
  name: string
  html: string
  updatedAt: string
}): EmailSignature {
  return {
    id: input.id,
    name: input.name.trim() || 'Untitled signature',
    html: sanitizeEmailBodyHtml(input.html),
    source: 'local',
    updatedAt: input.updatedAt,
  }
}

export function appendSignatureHtml(bodyHtml: string, signatureHtml: string) {
  const signature = sanitizeEmailBodyHtml(signatureHtml).trim()

  if (!signature) {
    return sanitizeEmailBodyHtml(bodyHtml)
  }

  return sanitizeEmailBodyHtml(`${bodyHtml}<br>${signature}`)
}
