# Product Model: Open Source Core And Hosted SaaS

Copy to Gmail has one shipped artifact today: an open-source, local-first Gmail-ready drafting studio. The repo should also leave room for a hosted/SaaS product without making the local app feel like an upsell surface or weakening its privacy guarantees.

## Open-Source Local Core

The open-source core is the default product and must remain complete on its own.

- `src/` contains the shared composing experience, sanitizer flow, theme system, clipboard flow, Gmail readiness checks, local library UI, and optional local Gmail Draft sync UI.
- `bin/copy-to-gmail.mjs` serves the production build from `dist/` on `127.0.0.1` and owns the local API surface.
- `skills/` contains open drafting assets that can be used independently of the hosted product lane.
- `docs/gmail-integration.md`, `docs/release-checklist.md`, and `docs/npm-publishing.md` document the local app and package release path.

Open-source guarantees:

- The composer works without an account.
- Gmail sync is optional and same-origin/local-server backed.
- No telemetry, hosted database, billing, or SaaS account is required for copy, preview, source mode, theme JSON, local templates, signatures, variables, import, or export.
- Draft JSON, library bundle JSON, theme JSON, and clipboard output remain portable data contracts.

## Hosted/SaaS Product Lane

The hosted lane should be treated as an additive product, not a replacement for the local core.

Appropriate hosted responsibilities:

- managed OAuth setup and account policy;
- team template and signature libraries;
- shared variable sets and approval workflows;
- organization-level safety checks;
- cross-device draft continuity;
- billing, seats, and workspace administration.

Hosted-specific code should be isolated in future top-level app/package boundaries such as `apps/hosted/` or `packages/saas/`. Do not place hosted account, billing, or telemetry assumptions in the local CLI server or shared composer code unless they are behind explicit interfaces that keep the local core fully functional.

## Boundary Rules

- Shared composer code can be reused by both products when it is account-agnostic and schema-stable.
- Local-only server code stays in the CLI path unless it is extracted behind a documented shared interface.
- Hosted APIs must not be required for open-source compose, copy, preview, import, export, theme, or local library workflows.
- Any schema change to draft, library, or theme JSON needs tests, docs, and migration guidance before either product can rely on it.
- The app UI should remain compose-first. Hosted product messaging belongs in documentation, onboarding, or a dedicated hosted shell, not in the working editor canvas.

## Design Implication

The local app should feel like a polished personal productivity tool. The hosted product can add account and collaboration surfaces later, but the writing surface remains the hierarchy anchor in both products.
