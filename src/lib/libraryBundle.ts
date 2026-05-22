import { sanitizeEmailBodyHtml } from './clipboard'
import type { EmailSignature } from './signatures'
import type { EmailTemplate, VariableSet } from './templates'

export type LibraryBundle = {
  version: 1
  templates: EmailTemplate[]
  signatures: EmailSignature[]
  variableSets: VariableSet[]
}

export function createEmptyLibrary(): LibraryBundle {
  return {
    version: 1,
    signatures: [],
    templates: [],
    variableSets: [],
  }
}

export function parseLibraryBundle(value: unknown): LibraryBundle {
  if (!isObject(value)) {
    return createEmptyLibrary()
  }

  return {
    version: 1,
    signatures: Array.isArray(value.signatures)
      ? value.signatures.map(parseSignature).filter(isPresent)
      : [],
    templates: Array.isArray(value.templates)
      ? value.templates.map(parseTemplate).filter(isPresent)
      : [],
    variableSets: Array.isArray(value.variableSets)
      ? value.variableSets.map(parseVariableSet).filter(isPresent)
      : [],
  }
}

export function serializeLibraryBundle(bundle: LibraryBundle): string {
  return JSON.stringify(parseLibraryBundle(bundle), null, 2)
}

export function mergeLibraryBundles(
  current: LibraryBundle,
  incoming: LibraryBundle,
): LibraryBundle {
  return {
    version: 1,
    signatures: mergeById(current.signatures, incoming.signatures),
    templates: mergeById(current.templates, incoming.templates),
    variableSets: mergeById(current.variableSets, incoming.variableSets),
  }
}

function parseTemplate(value: unknown): EmailTemplate | null {
  if (!isObject(value) || typeof value.id !== 'string') {
    return null
  }

  const recipients = isObject(value.recipients) ? value.recipients : {}
  const variables = Array.isArray(value.variables) ? value.variables : []

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : 'Untitled template',
    subject: typeof value.subject === 'string' ? value.subject : '',
    recipients: {
      bcc: typeof recipients.bcc === 'string' ? recipients.bcc : '',
      cc: typeof recipients.cc === 'string' ? recipients.cc : '',
      to: typeof recipients.to === 'string' ? recipients.to : '',
    },
    html: sanitizeEmailBodyHtml(
      typeof value.html === 'string' ? value.html : '',
    ),
    selectedSignatureId:
      typeof value.selectedSignatureId === 'string'
        ? value.selectedSignatureId
        : undefined,
    variables: variables
      .map((variable) => {
        if (!isObject(variable) || typeof variable.name !== 'string') {
          return null
        }

        return {
          name: variable.name,
          defaultValue:
            typeof variable.defaultValue === 'string'
              ? variable.defaultValue
              : undefined,
          label:
            typeof variable.label === 'string' ? variable.label : undefined,
        }
      })
      .filter(isPresent),
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

function parseSignature(value: unknown): EmailSignature | null {
  if (!isObject(value) || typeof value.id !== 'string') {
    return null
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : 'Untitled signature',
    html: sanitizeEmailBodyHtml(
      typeof value.html === 'string' ? value.html : '',
    ),
    source: value.source === 'gmail' ? 'gmail' : 'local',
    email: typeof value.email === 'string' ? value.email : undefined,
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

function parseVariableSet(value: unknown): VariableSet | null {
  if (!isObject(value) || typeof value.id !== 'string') {
    return null
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : 'Untitled variables',
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
    values: parseStringRecord(value.values),
  }
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      )
      .sort(([first], [second]) => first.localeCompare(second)),
  )
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const records = new Map(current.map((item) => [item.id, item]))

  for (const item of incoming) {
    records.set(item.id, item)
  }

  return Array.from(records.values())
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}
