import { describe, expect, it } from 'vitest'

import { buildGmailDraftUrl } from './gmailLinks'

describe('buildGmailDraftUrl', () => {
  it('builds an account-aware draft URL when a draft id exists', () => {
    expect(
      buildGmailDraftUrl({
        accountEmail: 'person@example.com',
        draftId: 'r123',
      }),
    ).toBe('https://mail.google.com/mail/u/person%40example.com/#drafts/r123')
  })

  it('falls back to the Gmail drafts folder', () => {
    expect(buildGmailDraftUrl({ accountEmail: 'person@example.com' })).toBe(
      'https://mail.google.com/mail/u/person%40example.com/#drafts',
    )
  })
})
