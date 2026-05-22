export function buildGmailDraftUrl(input: {
  accountEmail?: string
  draftId?: string
}): string {
  const account = input.accountEmail
    ? `/u/${encodeURIComponent(input.accountEmail)}`
    : '/u/0'

  if (!input.draftId) {
    return `https://mail.google.com/mail${account}/#drafts`
  }

  return `https://mail.google.com/mail${account}/#drafts/${encodeURIComponent(input.draftId)}`
}
