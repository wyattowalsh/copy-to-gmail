import { describe, expect, it } from 'vitest'

import { fingerprintDraft as fingerprintSubmittedGmailDraft } from '../../bin/lib/gmail-client.mjs'
import { createLocalDraft } from './drafts'
import { fingerprintDraft } from './fingerprints'

describe('Gmail draft fingerprints', () => {
  it('matches the browser fingerprint for submitted drafts', async () => {
    const draft = createLocalDraft({
      html: '<p>Hello   Gmail</p>',
      recipients: {
        bcc: 'hidden@example.com',
        cc: 'copy@example.com',
        to: 'a@example.com; b@example.com',
      },
      selectedSignatureId: 'sig-1',
      selectedTemplateId: 'template-1',
      subject: 'Hi',
    })

    await expect(fingerprintDraft(draft)).resolves.toBe(
      fingerprintSubmittedGmailDraft(draft),
    )
  })
})
