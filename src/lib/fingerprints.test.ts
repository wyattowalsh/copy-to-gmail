import { describe, expect, it } from 'vitest'

import { createLocalDraft } from './drafts'
import { fingerprintDraft } from './fingerprints'

describe('fingerprintDraft', () => {
  it('normalizes recipient separators and body whitespace', async () => {
    const first = await fingerprintDraft(
      createLocalDraft({
        html: '<p>Hello   Gmail</p>',
        recipients: { to: 'a@example.com; b@example.com' },
        subject: 'Hi',
      }),
    )
    const second = await fingerprintDraft(
      createLocalDraft({
        html: '<p>Hello Gmail</p>',
        recipients: { to: 'a@example.com, b@example.com' },
        subject: 'Hi',
      }),
    )

    expect(first).toBe(second)
  })
})
