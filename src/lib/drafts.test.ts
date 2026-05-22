import { describe, expect, it } from 'vitest'

import {
  createLocalDraft,
  findInvalidRecipients,
  parseDraftImport,
  serializeDraft,
} from './drafts'

describe('draft imports', () => {
  it('imports existing body-only draft exports as version 2 drafts', () => {
    const draft = parseDraftImport({
      version: 1,
      html: '<p>Hello <script>alert(1)</script>Gmail</p>',
    })

    expect(draft.version).toBe(2)
    expect(draft.html).toBe('<p>Hello Gmail</p>')
    expect(draft.subject).toBe('')
    expect(draft.recipients.to).toBe('')
  })

  it('round-trips version 2 draft metadata', () => {
    const original = createLocalDraft({
      html: '<p>Hello</p>',
      recipients: { to: 'a@example.com', cc: 'b@example.com' },
      subject: 'Follow up',
    })

    expect(parseDraftImport(JSON.parse(serializeDraft(original)))).toEqual(
      original,
    )
  })

  it('gently identifies invalid recipients without rejecting the draft', () => {
    expect(
      findInvalidRecipients({
        bcc: '',
        cc: 'bad-address',
        to: 'a@example.com; second@example.com',
      }),
    ).toEqual(['bad-address'])
  })
})
