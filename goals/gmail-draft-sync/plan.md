# Gmail Draft Sync Plan

## Solution Approach

Add Gmail as an optional same-origin local-server integration while preserving the current browser-only composer path. The React app stays usable without login; the existing `bin/copy-to-gmail.mjs` server grows a small local API for OAuth, Gmail Drafts, and protected local app-data files, with Gmail Drafts serving as remote persistence and local JSON files serving as templates, signatures, variables, and version snapshots.

## Ordered Steps

1. Define the draft metadata model.

   Touches: `src/lib/drafts.ts`, `src/lib/drafts.test.ts`, `src/App.tsx`.

   Add a first-class local draft shape that includes body HTML, plain text, subject, To, Cc, Bcc, selected signature id, selected template id, and optional Gmail linkage metadata. Keep the existing body-only editor behavior by giving metadata empty defaults. Update local draft export/import to a new versioned shape while still importing current version 1 body-only exports because users can already have copied those JSON backups.

   Verification: `pnpm typecheck`, `pnpm test:run -- src/lib/drafts.test.ts src/App.test.tsx`.

2. Add subject and recipient editing to the composer.

   Touches: `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, `src/lib/readiness.ts`, `src/lib/readiness.test.ts`.

   Add Subject, To, Cc, and Bcc controls above the body editor. Include metadata in draft metrics, export/import, preview summaries, and Gmail readiness messaging. Validate addresses gently with warnings instead of blocking local copy, since Gmail remains the final authority.

   Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test:run -- src/App.test.tsx src/lib/readiness.test.ts`.

3. Introduce the local app-data service.

   Touches: `bin/copy-to-gmail.mjs`, new `bin/lib/app-data.mjs`, new `bin/lib/app-data.test.mjs` or Vitest-compatible server tests, `README.md`.

   Add OS-specific app data directory resolution, macOS-first permissions, atomic JSON reads/writes, and no-database storage files for templates, signatures, variable sets, Gmail signature cache, and draft snapshots. Keep the server bound to `127.0.0.1` and reject non-local hosts as it does today.

   Verification: `pnpm test:run`, manual `pnpm build && pnpm start -- --no-open`, inspect that no files are created until a feature uses them.

4. Add protected token storage.

   Touches: `bin/lib/token-store.mjs`, `bin/copy-to-gmail.mjs`, `package.json`, tests for token-store behavior.

   Implement a token-store interface with macOS Keychain first and a strict-permission encrypted or protected local file fallback. Store only server-side. Never expose refresh tokens to the browser, logs, localStorage, export bundles, or draft JSON.

   Verification: token-store unit tests with keychain mocked, fallback permission tests where supported, `pnpm lint`, `pnpm typecheck`, manual disconnect confirms token deletion.

5. Add local OAuth endpoints.

   Touches: `bin/copy-to-gmail.mjs`, `bin/lib/oauth.mjs`, `bin/lib/config.mjs`, `README.md`, `docs/release-checklist.md`.

   Add endpoints for auth status, connect, callback, disconnect, and scope upgrade. Use Authorization Code with PKCE or an equivalent current local-app OAuth flow. Load user-supplied Google OAuth config from protected app data or explicit environment/config path, leaving room for a future official client config. Request draft scopes first; request Gmail settings/signature scope only from the signature import flow.

   Verification: mocked OAuth endpoint tests, manual connect with test credentials, revoked-token test shows reconnect state without clearing the local draft.

6. Add a Gmail API client boundary.

   Touches: `bin/lib/gmail-client.mjs`, `bin/copy-to-gmail.mjs`, tests with mocked fetch/API responses.

   Implement draft list, draft get, draft create, draft update, current profile email, and settings signatures import. Scope API reads to Gmail Drafts and selected draft ids only. Convert between local metadata/body model and Gmail MIME messages with sanitized HTML plus text fallback.

   Verification: unit tests for MIME encode/decode, recipients, subject, body extraction, API error mapping, and signature permission gating.

7. Add Gmail connection UI.

   Touches: `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, maybe new `src/lib/gmailApi.ts`.

   Add an optional Gmail panel showing disconnected, connected email, reconnect/error, and disconnected local-only states. Add connect, disconnect, draft list, load draft, create draft, update draft, and Open in Gmail controls. Hide Gmail-only controls until the user connects or a relevant error/reconnect state exists.

   Verification: `pnpm test:run -- src/App.test.tsx`, manual local-only smoke test with no OAuth config, manual connected smoke test with test credentials.

8. Add linked draft fingerprints and snapshots.

   Touches: `src/lib/fingerprints.ts`, `src/lib/fingerprints.test.ts`, `bin/lib/app-data.mjs`, `src/App.tsx`, server snapshot endpoints.

   Compute stable fingerprints from subject, recipients, sanitized body HTML, text fallback, selected signature, and selected template. Store last-synced Gmail fingerprint and local version snapshots under app data for active linked drafts. Keep snapshots local-only and bounded so storage cannot grow without limit.

   Verification: deterministic fingerprint tests, snapshot write/read tests, conflict setup test with changed remote fingerprint.

9. Add significance-based autosync.

   Touches: `src/App.tsx`, `src/lib/autosync.ts`, `src/lib/autosync.test.ts`, `src/App.test.tsx`.

   Start autosync only after the user creates, loads, or links a Gmail draft. Treat subject/recipient changes, meaningful body changes, signature changes, template application, and max unsynced time as significant. Ignore focus, cursor, and editor-noise updates. Before updating Gmail, fetch the current remote fingerprint and update only if it matches the last-synced fingerprint.

   Verification: autosync threshold tests, fake-timer debounce tests, remote-changed test enters conflict instead of overwriting.

10. Add conflict resolution.

    Touches: `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, server draft endpoints.

    Add a side-by-side local vs Gmail compare UI for subject, recipients, body summary/source, signature/template markers, and timestamps where available. Implement Replace Local, Overwrite Gmail with explicit confirmation, Save New Gmail Draft Version, and Cancel. Never discard unsynced local edits without explicit user choice.

    Verification: UI tests for all four actions, manual conflict reproduction with two browser windows or mocked remote update.

11. Add Open in Gmail routing.

    Touches: `src/lib/gmailLinks.ts`, `src/lib/gmailLinks.test.ts`, `src/App.tsx`.

    Store Gmail `draft.id` and `message.id` on linked drafts. Construct the best known account-aware Gmail draft URL using the connected email/account context. If exact draft opening is unreliable, fall back to Gmail Drafts and show the draft subject and sync status locally so the user can identify it.

    Verification: link construction tests, manual browser open for a synced draft and fallback route.

12. Add templates, variables, and signatures.

    Touches: `src/lib/templates.ts`, `src/lib/templates.test.ts`, `src/lib/signatures.ts`, `src/lib/signatures.test.ts`, `src/App.tsx`, `src/App.css`, app-data endpoints, `README.md`.

    Build a local template library for rich body HTML, subject, To, Cc, Bcc, signature selection, and custom variable definitions. Add a fill-in step for placeholders such as `{{first_name}}` and custom variables. Add local signatures and imported Gmail signatures, with Gmail import behind the additional permission flow.

    Verification: placeholder rendering tests, import/export tests, signature insert tests, permission upgrade manual test.

13. Add import/export bundle support.

    Touches: `src/lib/libraryBundle.ts`, `src/lib/libraryBundle.test.ts`, `src/App.tsx`, app-data endpoints, `README.md`.

    Support whole-library JSON bundles plus individual template, signature, and variable-set export/import. Exclude credentials, Gmail account identifiers unless necessary for user-visible labels, refresh tokens, local snapshots, and Gmail fingerprints from portable bundles.

    Verification: schema tests, round-trip tests, malformed bundle tests, manual export/import through UI.

14. Update documentation and privacy copy.

    Touches: `README.md`, `docs/release-checklist.md`, maybe new `docs/gmail-integration.md`.

    Replace the current absolute “does not use the Gmail API” wording with conditional language: Gmail API access is optional and only used after connection. Document requested scopes, app-data storage, token storage, no database, no sending, no inbox reading, and local fallback behavior.

    Verification: `pnpm format:check`, manual docs review against `facts.md`.

15. Run full release validation.

    Touches: no code unless failures require fixes.

    Run the existing validation suite and one manual local-only smoke test plus one connected Gmail smoke test with test credentials.

    Verification: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build`, `npm pack --dry-run --json`, and `npm publish --dry-run` before release.

## Risks And Open Questions

- Exact Gmail draft deep-link URLs are not guaranteed by the Gmail API contract, so the implementation must treat specific-draft opening as best effort and keep the Gmail Drafts fallback.
- Gmail signature import may require Admin or user settings scopes that are more sensitive than draft scopes; keep it opt-in and separate.
- Browser editor updates may be noisy through `@react-email/editor`; autosync must rely on normalized fingerprints and debounced significance rather than raw update events.
- Keychain availability and npm dependency choice need a small prototype before locking the token-store implementation.
- Gmail API quotas and OAuth verification requirements may affect any future official client config; user-supplied config is the first implementation path.
