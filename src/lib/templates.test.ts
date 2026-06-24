import { describe, expect, it } from 'vitest'

import { createLocalDraft } from './drafts'
import {
  applyTemplate,
  collectTemplateVariables,
  createTemplateFromDraft,
  renderPlaceholders,
} from './templates'

describe('templates', () => {
  it('collects placeholders across metadata and body', () => {
    expect(
      collectTemplateVariables({
        html: '<p>Hello {{first_name}}</p>',
        recipients: { bcc: '', cc: '{{manager_email}}', to: '{{email}}' },
        subject: 'Hi {{first_name}}',
      }),
    ).toEqual(['email', 'first_name', 'manager_email'])
  })

  it('creates and applies rich templates with values', () => {
    const template = createTemplateFromDraft({
      draft: createLocalDraft({
        html: '<p>Hello {{first_name}}</p>',
        recipients: { to: '{{email}}' },
        subject: 'Hi {{first_name}}',
      }),
      id: 'tpl_1',
      name: 'Intro',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const draft = applyTemplate(template, {
      email: 'ada@example.com',
      first_name: 'Ada',
    })

    expect(draft.subject).toBe('Hi Ada')
    expect(draft.recipients.to).toBe('ada@example.com')
    expect(draft.html).toContain('Hello Ada')
  })

  it('renders missing placeholders as empty strings', () => {
    expect(renderPlaceholders('Hello {{name}}', {})).toBe('Hello ')
  })

  it('sanitizes placeholder values before returning applied template HTML', () => {
    const template = createTemplateFromDraft({
      draft: createLocalDraft({
        html: '<p>Hello {{name}}</p>',
      }),
      id: 'tpl_unsafe',
      name: 'Unsafe',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const draft = applyTemplate(template, {
      name: '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
    })

    expect(draft.html).toContain('bad')
    expect(draft.html).not.toContain('<img')
    expect(draft.html).not.toContain('onerror')
    expect(draft.html).not.toContain('javascript:')
  })
})
