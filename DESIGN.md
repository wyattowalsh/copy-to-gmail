# Copy to Gmail Design Spec

## Concept

Copy to Gmail uses `public/icon.png` as the source of truth. The interface should feel like the icon was expanded into an app: a glossy white code document, stacked blue copy sheets, a blue transfer arrow, and a Gmail-style envelope with red, yellow, green, and blue accents.

The app stays compose-first. The first screen is the working email studio, not a landing page.

## Source Asset

- Primary icon: `public/icon.png`.
- Browser favicon: `public/icon.png`.
- Do not introduce a separate generated logo concept.
- Do not replace the icon with an abstract or simplified mark unless the source icon itself changes.
- The icon must keep a real alpha channel. Do not ship it with a white or checkerboard square baked into the pixels.
- The header mark should render the PNG directly, without a separate white tile behind it.

## Visual Translation

- White document panels map to editor paper, metadata fields, and modal surfaces.
- Stacked blue sheets map to left rails, tool clusters, and focused interaction surfaces.
- The copy badge maps to primary copy actions.
- The curved blue arrow maps to movement, transfer, and validation affordances.
- The Gmail envelope maps to sync/readiness accents: red for blocking/errors, yellow for caution, green for success, and blue for the copy path.

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

- Background: `#f2f7ff`
- Panel: `#f8fbff`
- Paper: `#ffffff`
- Ink: `#071e49`
- Muted: `#5b6b80`
- Line: `#d6e1ee`
- Strong line: `#9eb4ce`

### Default Dark Theme

- Background: `#081631`
- Panel: `#0f203f`
- Paper: `#14294c`
- Ink: `#f5f9ff`
- Muted: `#a9bdd6`
- Line: `#274468`
- Strong line: `#436894`

## Surface Rules

- Do not use a checkerboard behind the icon. Use a faint straight grid or blue wash for structure instead.
- Keep large surfaces glossy and layered, with white panels over blue-tinted rails.
- Prefer direct icon colors over new palette invention.
- Keep the icon visible in the app chrome as the brand anchor.
- Cards and controls should generally stay at `8px` radius; the header icon container may be rounder to preserve the icon's glossy app-icon feel.
- Avoid decorative blobs and unrelated illustration.

## Components

### Chrome

- The header uses `public/icon.png` directly.
- The icon container should not add its own filled background; use image drop shadow for depth.
- The chrome background uses white glass, subtle blue wash, and navy shadow.

### Composer

- The editor workbench uses the icon's checker/grid background and blue-sheet left edge.
- The editor paper remains white with a blue offset shadow that echoes the stacked blue documents.
- Headings may use a small blue/cyan code-line accent, matching the short colored code bars in the icon.

### Inspector Cards

- Inspector cards inherit the document-panel look: white, blue-tinted, compact, and highly scannable.
- Readiness states use the icon's Gmail colors: green success, yellow caution, red blocked/error.

### Actions

- Primary copy actions use the glossy arrow blue gradient.
- Secondary controls are white document buttons with blue-gray borders.
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
