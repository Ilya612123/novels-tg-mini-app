# Agent Instructions

## Mini App Design System

- Treat `apps/miniapp/src/styles.css` as the source of truth for UI design tokens.
- Do not introduce raw `font-size`, `line-height`, `font-weight`, color, spacing, radius, shadow, or control-height values inside component rules when an existing token can express the value.
- Add or adjust tokens in `:root` first, then consume them with `var(...)` in UI rules.
- Keep Telegram Mini App typography mobile-first:
  - body: `--font-size-body` / `--line-height-body`
  - callout/buttons: `--font-size-callout` / `--line-height-callout`
  - secondary text: `--font-size-subhead` or `--font-size-footnote`
  - captions/badges: `--font-size-caption`
  - headings: `--font-size-title-*` or `--font-size-large-title`
  - reader text: `--reader-font-size` / `--reader-line-height`
- Use `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`, and `--font-weight-bold`; avoid heavier ad hoc weights such as `800` and `900`.
- Prefer Telegram theme aliases (`--tg-color-*`) for app surfaces, text, links, and buttons so the Mini App follows Telegram themes.
- Keep interactive elements at tokenized touch sizes, especially `--control-height-sm`, `--control-height-md`, and `--control-height-lg`.
- After UI token or CSS changes, run:

```bash
pnpm --filter @novell-reader/miniapp test -- src/styles.test.ts
pnpm --filter @novell-reader/miniapp typecheck
pnpm --filter @novell-reader/miniapp build
```
