import { sanitizeEmailBodyHtml, stripHtml } from './clipboard'
import {
  createLocalDraft,
  type DraftRecipients,
  type LocalDraft,
} from './drafts'

export type TemplateVariableDefinition = {
  name: string
  label?: string
  defaultValue?: string
}

export type VariableSet = {
  id: string
  name: string
  values: Record<string, string>
  updatedAt: string
}

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  recipients: DraftRecipients
  html: string
  selectedSignatureId?: string
  variables: TemplateVariableDefinition[]
  updatedAt: string
}

const placeholderPattern = /{{\s*([a-zA-Z_][\w.-]*)\s*}}/g

export function createTemplateFromDraft(input: {
  id: string
  name: string
  draft: LocalDraft
  updatedAt: string
}): EmailTemplate {
  return {
    id: input.id,
    name: input.name.trim() || 'Untitled template',
    subject: input.draft.subject,
    recipients: input.draft.recipients,
    html: sanitizeEmailBodyHtml(input.draft.html),
    selectedSignatureId: input.draft.selectedSignatureId,
    variables: collectTemplateVariables({
      html: input.draft.html,
      recipients: input.draft.recipients,
      subject: input.draft.subject,
    }).map((name) => ({ name })),
    updatedAt: input.updatedAt,
  }
}

export function applyTemplate(
  template: EmailTemplate,
  values: Record<string, string>,
  signatureHtml = '',
): LocalDraft {
  const html = appendTemplateSignature(
    renderHtmlPlaceholders(template.html, values),
    signatureHtml,
  )

  return createLocalDraft({
    html,
    recipients: {
      bcc: renderPlaceholders(template.recipients.bcc, values),
      cc: renderPlaceholders(template.recipients.cc, values),
      to: renderPlaceholders(template.recipients.to, values),
    },
    selectedSignatureId: template.selectedSignatureId,
    selectedTemplateId: template.id,
    sourceHtml: html,
    subject: renderPlaceholders(template.subject, values),
    text: stripHtml(html),
  })
}

export function collectTemplateVariables(input: {
  html: string
  recipients: DraftRecipients
  subject: string
}): string[] {
  return uniqueSorted([
    ...extractPlaceholderNames(input.subject),
    ...extractPlaceholderNames(input.recipients.to),
    ...extractPlaceholderNames(input.recipients.cc),
    ...extractPlaceholderNames(input.recipients.bcc),
    ...extractPlaceholderNames(input.html),
  ])
}

export function extractPlaceholderNames(value: string): string[] {
  return uniqueSorted(
    Array.from(value.matchAll(placeholderPattern), (match) => match[1]),
  )
}

export function renderPlaceholders(
  value: string,
  values: Record<string, string>,
): string {
  return value.replace(placeholderPattern, (_match, name: string) => {
    return values[name] ?? ''
  })
}

function renderHtmlPlaceholders(
  value: string,
  values: Record<string, string>,
): string {
  return value.replace(placeholderPattern, (_match, name: string) => {
    return escapeHtml(stripHtml(sanitizeEmailBodyHtml(values[name] ?? '')))
  })
}

function appendTemplateSignature(html: string, signatureHtml: string): string {
  const signature = sanitizeEmailBodyHtml(signatureHtml).trim()

  if (!signature) {
    return sanitizeEmailBodyHtml(html)
  }

  return sanitizeEmailBodyHtml(`${html}<br>${signature}`)
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
