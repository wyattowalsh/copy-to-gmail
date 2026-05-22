# Changelog

All notable changes to Copy to Gmail will be documented in this file.

## 0.1.0 - Unreleased

- Added a local-only `copy-to-gmail` CLI for `npx` and packaged `dist/` serving.
- Added visual and source editor modes with sanitized Gmail-ready preview output.
- Added light, dark, system, preset, and custom JSON themes.
- Added settings for editor defaults, clipboard privacy reminders, and local draft recovery preference.
- Added draft metrics, preview tabs, validation refresh, formatting cleanup, and draft JSON import/export tools.
- Hardened sanitizer behavior with DOMPurify, explicit URL protocol checks, and relative-link removal.
- Added tests for source mode, theme JSON validation, readiness fallback behavior, and clipboard paths.
- Added optional Gmail Draft sync with local OAuth, draft metadata, autosync preflight checks, conflict resolution, and Open in Gmail actions.
- Added a local template, signature, Gmail-signature, and variable-set library with JSON bundle import/export.
