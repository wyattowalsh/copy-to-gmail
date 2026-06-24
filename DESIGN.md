# Copy to Gmail Design Spec

## Concept

Copy to Gmail uses `public/icon.png` as the source of truth, but the product UI is a restrained composition tool rather than a literal expansion of the icon. The interface should feel calm, precise, local-first, and optimized for repeated daily drafting.

The app stays compose-first. The first screen is the working email studio, not a landing page.

## Product Surfaces

- **Open-source core:** the local CLI app, editor, sanitizer, clipboard writer, local library, theme system, and optional local Gmail Draft sync. This surface must feel complete without a hosted account.
- **Hosted/SaaS lane:** future managed OAuth, team templates, shared libraries, workspace policy, and account administration. Hosted affordances should live in their own shell or docs rather than competing with the local editor.
- Shared UI work should keep the editor canvas dominant and avoid turning the local app into a marketing or account-management surface.

## Source Asset

- Primary icon: `public/icon.png`.
- Browser favicon: `public/icon.png`.
- Do not introduce a separate generated logo concept.
- Do not replace the icon with an abstract or simplified mark unless the source icon itself changes.
- The icon must keep a real alpha channel. Do not ship it with a white or checkerboard square baked into the pixels.
- The header mark should render the PNG directly, without a separate white tile behind it.

## Visual Translation

- The logo stays visible in the header as the primary multicolor moment.
- White document panels map to editor paper, metadata fields, and modal surfaces.
- Blue is reserved for the copy path and focused controls.
- Gmail-adjacent red, yellow, and green are functional state colors only: error, caution, and success.
- Inspector surfaces use subtle borders, spacing, and type hierarchy rather than decorative elevation.
- Theme presets are a searchable, indexed library, not a gallery. Group them by practical intent and keep Rosé Pine variants named and colored from the official main, dawn, and moon palettes.

## Color Tokens

### Core Palette

- Document white: `#ffffff`
- App background: `#f2f7ff`
- Deep code blue: `#071e49`
- Primary arrow blue: `#075df1`
- Gloss highlight blue: `#4bb8ff`
- Code cyan: `#10b8d5`
- Code purple: `#6247ff`
- Gmail red: `#f7271c`
- Gmail yellow: `#f4b400`
- Gmail green: `#0f9d3f`

### Default Light Theme

- Background: `#f6f7f9`
- Panel: `#fbfcfe`
- Paper: `#ffffff`
- Ink: `#18202a`
- Muted: `#5b6472`
- Line: `#d8dee8`
- Strong line: `#aeb8c7`

### Default Dark Theme

- Background: `#111827`
- Panel: `#172033`
- Paper: `#1f2937`
- Ink: `#f7f9fc`
- Muted: `#a8b2c1`
- Line: `#303b4f`
- Strong line: `#526077`

## Surface Rules

- Do not use a checkerboard, decorative grid, glow, or bokeh treatment behind the icon or editor.
- Keep large surfaces quiet and utilitarian, with clear borders and modest shadows.
- Prefer direct icon colors over new palette invention.
- Keep the icon visible in the app chrome as the brand anchor.
- Cards and controls should generally stay at `8px` to `12px` radius.
- Avoid decorative blobs, unrelated illustration, excessive glassmorphism, and ornamental animation.

## Components

### Chrome

- The header uses `public/icon.png` directly.
- The icon container should not add its own filled background; use image drop shadow for depth.
- The chrome background is a compact app bar with a simple border and stable controls.

### Composer

- The editor is the dominant workspace.
- Draft body metrics, source diagnostics, and focus affordances should sit next to the editor instead of being buried in subordinate panels.
- The editor paper remains white in light mode and high-contrast in dark mode.
- Metadata, readiness, and actions sit close to the editor without competing with it.

### Inspector Cards

- Inspector cards are compact, subordinate, and highly scannable.
- Readiness states use the icon's Gmail colors: green success, yellow caution, red blocked/error.

### Actions

- `Copy for Gmail` is the only primary call to action in the main composer.
- Primary copy actions use a flat blue accent.
- Secondary controls are quiet document buttons with blue-gray borders.
- Keep labels direct: "Copy for Gmail", "Preview", "Validate", "Settings".

## Motion

- Hover motion is limited to a 1px lift.
- No animated decorative background.
- Respect `prefers-reduced-motion`.

## Accessibility

- Maintain visible focus rings on all controls.
- Preserve semantic headings and screen-reader labels.
- Keep text letter spacing at `0`.
- Ensure mobile controls wrap into stable grid tracks without changing width on hover.
