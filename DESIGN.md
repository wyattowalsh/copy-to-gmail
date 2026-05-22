# Copy to Gmail Design Spec

## Concept

Copy to Gmail uses a "compiled mail" visual system: structured HTML on the left, Gmail-ready mail on the right, and a confident transfer gesture between them. The design is based on the supplied legacy HTML-to-Gmail icon and the generated concept asset at `public/logo-concept.png`.

The interface should feel like a local desktop studio, not a marketing page. The first screen stays focused on composing, validating, previewing, and copying a Gmail-ready body.

## Brand Mark

- Primary asset: `public/brand-mark.svg`.
- Favicon asset: `public/favicon.svg`.
- Exploratory generated concept: `public/logo-concept.png`.
- The mark combines a folded HTML document, a mail tile, and a blue transfer arrow.
- Keep the mark on deep navy or white surfaces with enough breathing room to preserve the navy keyline.
- Do not recreate the exact Gmail logo. Use the red envelope chevron plus blue, green, and yellow side accents as a visual reference only.

## Color Tokens

### Core Palette

- Navy ink: `#061b3a`
- Primary blue: `#0b66e4`
- Soft blue highlight: `#64b5ff`
- Mail red: `#d93025`
- Mail green: `#188038`
- Mail yellow: `#f9ab00`
- White glass: `#ffffff`

### Default Light Theme

- Background: `#eef5ff`
- Panel: `#f8fbff`
- Paper: `#ffffff`
- Ink: `#061b3a`
- Muted: `#526174`
- Line: `#cfdded`
- Strong line: `#9fb4cc`

### Default Dark Theme

- Background: `#07111f`
- Panel: `#0d1a2c`
- Paper: `#111f34`
- Ink: `#f4f8ff`
- Muted: `#a8b8cc`
- Line: `#213a58`
- Strong line: `#3b5c82`

## Surface Rules

- Compose-first layout: keep the editor as the main screen and the inspector as a supporting column.
- Use subtle grid texture to imply HTML structure and email layout precision.
- Use angular blue/yellow/green/red background planes instead of decorative blobs.
- Keep panels crisp. Cards and controls should use `8px` radius where possible; larger radius is reserved for the app mark or outer shell.
- Use high-contrast navy keylines for important visual assets and soft blue focus rings for interaction.
- Avoid one-hue screens. Each primary view should include navy, blue, white, and at least one mail accent color.

## Components

### Chrome

- Sticky top chrome uses a glass panel with a light blue wash and navy shadow.
- The app mark appears at 48px on desktop and 36px on mobile.
- Theme and settings controls stay compact so the composing area remains dominant.

### Composer

- The editor workbench uses a structured grid background with restrained red and yellow diagonal washes.
- The email page itself remains white and high contrast, with a clear paper boundary and a deep navy shadow.
- Visual and Source mode controls use segmented buttons with blue active state.

### Inspector Cards

- Readiness, Gmail sync, library, and metrics cards share the same 8px card radius and light blue panel wash.
- Status pills use the semantic palette: green for ready/synced, yellow for warnings/pending, red for blocked/error.
- Metrics should stay dense and scannable.

### Actions

- Primary action uses the blue gradient from `#64b5ff` to `#0b66e4`.
- Secondary actions are white glass controls with strong line color.
- Button labels should remain direct commands: "Copy for Gmail", "Preview", "Validate", "Settings".

## Motion

- Hover motion is limited to a 1px lift.
- No animated background decoration.
- Respect `prefers-reduced-motion`.

## Accessibility

- Maintain visible focus rings on all controls.
- Preserve the semantic heading structure and screen-reader labels.
- Keep text letter spacing at `0`.
- Ensure mobile controls wrap into stable grid tracks without changing width on hover.
