# Ayesh Desktop · DESIGN.md

Declared 2026-09-23, per audit 001 item 004 (R-37). This file ratifies the
direction the UI already runs on, so future changes are directed instead of
falling silently into a neutral default. Revisit the dials before any visual
overhaul.

## Dials

| Dial        | Value                                                         | Reason                                                              |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| E-1 Energy  | 1 (Low)                                                       | Developer/agent tool: calm chrome, no hype surfaces                 |
| E-2 Rhythm  | 1 (Repetitive)                                                | Message rows and list rows repeat one pattern                       |
| E-3 Motion  | 1 (Still) in chrome, 3 (Intermittent) in status feedback only | Streaming/empty/error may animate briefly; never continuous loops   |
| E-4 Density | 2 (Balanced)                                                  | Chat capped at 900px, 0.75rem row padding, settings is a plain form |
| E-5 Warmth  | 1 (Cool)                                                      | Dark neutrals with a single cool accent                             |
| Type scale  | base 16px, ratio ~1.25 (0.8 / 0.85 / 0.9 / 1 / 1.1 / 1.5)     | Sizes already in use across Chat and header                         |
| Character   | Technical, terse, Indonesian UI copy                          | Matches AGENTS.md language: report, no filler                       |

## Palette

- Base `#0f0f0f`, surface `#1a1a1a`, raised `#2a2a2a`
- Border `#333` / `#444`, text `#e0e0e0`, muted `#aaa` / `#888`
- Single accent: teal `#00d4aa` (hover `#00f5c4`), black text on accent fills
- Semantic only: error `#ff6b6b` / `#ff4444`, warning `#ffa94d`, success `#51cf66`
- User bubble `#12352f`: dark teal tint, deliberately a shade of the accent hue
  (not a new color), right-aligned + slightly darker than surface so user
  messages read as "mine" without introducing a second core color

## Typography

System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`).
Reason (closes audit 001 item 010, R-06): native desktop look with zero
webfont load inside Electron; matches OS chrome so the app feels like part of
the desktop, not a web page. No second family until there is a brand reason
to add one.

## Rules

- Dark theme is fixed: this is a developer/agent tool, R-21 allows a fixed
  theme when the product has a strong reason. No light toggle unless requested.
- Radius 8px on interactive surfaces. No gradients, glassmorphism, neon, or
  orbs, per R-01.
- Em dash is banned in all copy (R-02): use `·`, `,`, `;`, `:` or `()`.
- Every data view declares empty, loading and error states (R-27).
- Motion only for state feedback, and it must respect
  `prefers-reduced-motion`.
- Emoji as icons is banned (R-04, closed by audit 001 item 005): status uses
  colored CSS dots/tags and text labels instead. Do not reintroduce emoji
  as icons or decoration.
