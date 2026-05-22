---
name: gmail-composer-drafter
description: >-
  Generate, revise, and convert paste-ready email drafts for Copy to Gmail. Use when composing Gmail messages through gmail-composer. NOT for inbox triage, sending, Gmail API automation, or raw HTML.
argument-hint: '[draft|revise|outline|subject|paste-plan] [brief]'
model: opus
license: MIT
compatibility: 'Works with the local copy-to-gmail editor launched by gmail-composer. No Gmail API access required.'
metadata:
  author: wyattowalsh
  version: '1.0.0'
---

# Gmail Composer Drafter

Draft and refine email content intended for the local Copy to Gmail editor. The output is prose-first: the user enters the content in the visual editor, then uses **Copy for Gmail** to place rich HTML on the clipboard.

NOT for inbox triage, sending mail, Gmail API actions, filter creation, raw HTML source authoring, or newsletter platform setup.

## Dispatch

| $ARGUMENTS                                 | Action                                             | Example                                                       |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| `draft <brief>`                            | Mode A: Draft a complete email                     | `/gmail-composer-drafter draft product update for beta users` |
| `revise <existing copy>`                   | Mode B: Improve existing email copy                | `/gmail-composer-drafter revise make this warmer`             |
| `outline <goal>`                           | Mode C: Produce an email structure before drafting | `/gmail-composer-drafter outline investor update`             |
| `subject <brief>`                          | Mode D: Generate subject and preview text options  | `/gmail-composer-drafter subject launch announcement`         |
| `paste-plan <copy>`                        | Mode E: Convert copy into editor-entry guidance    | `/gmail-composer-drafter paste-plan this markdown draft`      |
| Natural-language email composition request | Auto-detect the closest mode                       | `write a concise follow-up email`                             |
| Empty                                      | Show mode menu with examples                       | `/gmail-composer-drafter`                                     |

### Auto-Detection Heuristic

1. New-message verbs like write, draft, compose, announce, invite, follow up -> **Mode A: Draft**.
2. Improvement verbs like revise, polish, shorten, warm up, sharpen -> **Mode B: Revise**.
3. Planning verbs like outline, structure, sequence -> **Mode C: Outline**.
4. Subject-line-only requests -> **Mode D: Subject**.
5. Requests about moving text into the visual editor -> **Mode E: Paste Plan**.
6. Inbox management, Gmail search, labels, filters, cleanup, or sending -> refuse and redirect to `email-whiz` where appropriate.
7. If audience, goal, or call to action is missing and the request is high-stakes, ask up to three concise questions; otherwise make conservative assumptions and label them.

## Progressive Disclosure

Load `references/composition-guide.md` for all modes except empty-args help. Do not load all resources at once. Load scripts only for validation or smoke checks.

## Modes

### Mode A: Draft

Produce:

1. **Subject**: one recommended subject line.
2. **Preview Text**: one inbox preview sentence.
3. **Email Body**: formatted with headings, short paragraphs, links as plain URLs or labeled link text, and a clear call to action.
4. **Editor Notes**: concise guidance for using `gmail-composer` blocks, links, buttons, or emphasis.

### Mode B: Revise

1. Identify the current intent, audience, and tone.
2. Preserve facts, promises, dates, prices, links, and commitments unless the user asks to change them.
3. Return the revised email plus a short changelog of meaningful edits.
4. If the copy is ambiguous or legally/commercially sensitive, flag the assumption instead of inventing facts.

### Mode C: Outline

Return a structure the user can approve before drafting:

| Section | Purpose               | Notes                    |
| ------- | --------------------- | ------------------------ |
| Opening | Why this email exists | Keep under two sentences |
| Body    | Main update or ask    | Use 1-3 short sections   |
| CTA     | Next step             | One primary action       |
| Close   | Human signoff         | Match relationship       |

### Mode D: Subject

Return 5-8 options grouped by tone: direct, warm, concise, curiosity-light, and formal when relevant. Include one preview-text recommendation.

### Mode E: Paste Plan

Convert existing text into editor-entry guidance:

1. Normalize headings, paragraphs, bullets, and links.
2. Tell the user what to enter as blocks in the visual editor.
3. Do not output raw HTML unless explicitly requested for debugging.
4. End with: Open `gmail-composer`, enter the content, click **Copy for Gmail**, then paste into Gmail compose with Plain text mode off.

## Output Contract

Use this structure unless the user asks for a different format:

```markdown
Subject: ...
Preview Text: ...

Email Body:
...

Editor Notes:

- ...
```

Keep body copy ready for direct editing. Avoid meta-commentary inside the email body.

## Validation Contract

When editing this skill, run:

```bash
uv run wagents skills read /Users/ww/dev/projects/copy-to-gmail/skills/gmail-composer-drafter
uv run python /Users/ww/dev/projects/agents/skills/skill-creator/scripts/audit.py /Users/ww/dev/projects/copy-to-gmail/skills/gmail-composer-drafter --format json
uv run python skills/skill-creator/scripts/audit.py skills/<name>/ --format json
uv run python /Users/ww/dev/projects/copy-to-gmail/skills/gmail-composer-drafter/scripts/smoke.py --format json
```

If the skill is copied into the agents monorepo, also run `uv run wagents validate`, `uv run wagents eval validate`, and `uv run wagents package gmail-composer-drafter --dry-run` from that repo before publishing.

Completion criteria: the skill reads by path, the audit score is A-grade, eval coverage includes explicit, implicit, negative control, revise, outline, subject, empty, and paste-plan routes, and the smoke check reports zero errors.

## Critical Rules

1. Never send email or claim an email was sent.
2. Never use Gmail API tools; this skill is composition-only.
3. Never output raw HTML by default; the local editor owns rich HTML rendering.
4. Preserve user-provided facts, dates, links, offers, prices, and legal claims exactly unless asked to alter them.
5. Do not invent personalization details, testimonials, metrics, discounts, or deadlines.
6. Keep calls to action singular unless the user asks for multiple actions.
7. Make assumptions explicit when audience, relationship, or goal is underspecified.
8. Redirect inbox triage, filters, labels, cleanup, and analytics to `email-whiz`.
9. Mention `gmail-composer` only in Editor Notes, not inside the email body.
10. Prefer concise, scannable email copy over decorative formatting.

## Canonical Vocabulary

Canonical terms (use these exactly throughout):

| Term               | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| **Subject**        | Gmail subject line                                     |
| **Preview Text**   | Inbox preview/snippet copy                             |
| **Email Body**     | Content to enter into the visual editor                |
| **Editor Notes**   | Instructions for using Copy to Gmail controls          |
| **Copy for Gmail** | Button that writes rich clipboard HTML from the editor |

## Reference File Index

| File                              | Content                                                           | Read When           |
| --------------------------------- | ----------------------------------------------------------------- | ------------------- |
| `references/composition-guide.md` | Tone, structure, and Copy to Gmail handoff guidance               | All non-empty modes |
| `scripts/smoke.py`                | JSON smoke check for required skill files and eval manifest shape | Validation only     |
