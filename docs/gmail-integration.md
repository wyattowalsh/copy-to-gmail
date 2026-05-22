# Gmail Integration

Copy to Gmail supports an optional no-database Gmail Drafts integration through the packaged local server.

## Privacy Model

- Gmail access is opt-in and disabled until the user connects an account.
- The browser never receives refresh tokens.
- Draft JSON exports exclude credentials and portable exports should be treated as user-controlled content only.
- Gmail Drafts are used only for remote draft persistence.
- Local templates, signatures, variable sets, imported Gmail signature cache, and draft snapshots are app-data files, not database rows.
- The integration does not send mail, read the inbox, search messages, manage labels, manage threads, or access contacts.

## OAuth Configuration

Provide a Google OAuth client with one of these methods:

```sh
COPY_TO_GMAIL_GOOGLE_CLIENT_ID="your-client-id" \
COPY_TO_GMAIL_GOOGLE_CLIENT_SECRET="your-client-secret" \
copy-to-gmail --no-open
```

Or set `COPY_TO_GMAIL_GOOGLE_OAUTH_CONFIG` to a JSON file:

```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

The local callback path is `/api/gmail/oauth/callback` on the port printed by the CLI.

## Scopes

- `openid` and `email`: display the connected account.
- `https://www.googleapis.com/auth/gmail.compose`: create, list, load, and update Gmail drafts.
- `https://www.googleapis.com/auth/gmail.settings.basic`: requested only from the Gmail signature import action so the app can read the connected account's configured signatures.

## Sync And Conflicts

- Autosync starts only after the user creates, loads, or links a Gmail draft.
- Significant local edits include subject, recipients, meaningful body content, template application, and signature insertion.
- Before updating Gmail, the local server fetches the current remote draft and compares its normalized fingerprint with the last synced fingerprint.
- If Gmail changed remotely, sync pauses and the UI offers Replace Local, Overwrite Gmail, Save New Gmail Draft Version, or Cancel.
- Open in Gmail uses the connected account context and falls back to Gmail Drafts when exact draft routing is unreliable.

## Local Storage

App data defaults:

- macOS: `~/Library/Application Support/copy-to-gmail`
- Windows: `%LOCALAPPDATA%\copy-to-gmail`
- Linux: `$XDG_DATA_HOME/copy-to-gmail` or `~/.local/share/copy-to-gmail`

The server stores bounded draft snapshots in app data after Gmail create/update operations and stores the local library in `library.json`. On macOS, refresh credentials go to Keychain first. If Keychain is unavailable, `gmail-token.json` is written with strict file permissions in app data.

## Library Bundles

- Whole-library export/import covers templates, signatures, and variable sets.
- Individual template, signature, and variable-set export actions copy a one-item JSON bundle.
- Portable bundles exclude credentials, local snapshots, Gmail sync fingerprints, and Gmail account identifiers except user-visible signature labels.
