import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("miniapp design system", () => {
  it("defines typography and interface tokens for mobile Telegram UI", () => {
    expect(css).toContain("--font-size-body: 17px");
    expect(css).toContain("--line-height-body: 22px");
    expect(css).toContain("--font-size-callout: 16px");
    expect(css).toContain("--font-size-subhead: 15px");
    expect(css).toContain("--font-size-footnote: 13px");
    expect(css).toContain("--font-size-caption: 12px");
    expect(css).toContain("--font-size-title-1: 28px");
    expect(css).toContain("--font-size-large-title: 34px");
    expect(css).toContain("--font-weight-regular: 400");
    expect(css).toContain("--font-weight-medium: 500");
    expect(css).toContain("--font-weight-semibold: 600");
    expect(css).toContain("--color-bg: #181818");
    expect(css).toContain("--space-4: 16px");
    expect(css).toContain("--radius-md: 8px");
    expect(css).toContain("--control-height-md: 48px");
    expect(css).toContain("--book-title-lines: 3");
  });

  it("uses typography tokens for core miniapp surfaces", () => {
    expect(css).toMatch(/h1\s*{[^}]*font-size:\s*var\(--font-size-title-1\)/s);
    expect(css).toMatch(/\.primary-button\s*{[^}]*font-size:\s*var\(--font-size-callout\)/s);
    expect(css).toMatch(/\.text-button\s*{[^}]*font-size:\s*var\(--font-size-callout\)/s);
    expect(css).toMatch(/\.chapter\s*{[^}]*font-size:\s*var\(--reader-font-size\)/s);
    expect(css).toMatch(/\.winback-modal h2\s*{[^}]*font-size:\s*var\(--font-size-title-1\)/s);
    expect(css).not.toMatch(/font-weight:\s*(800|900)\b/);
  });

  it("keeps catalog card text height stable so cover previews align in the grid", () => {
    expect(css).toMatch(/\.book-card\s*{[^}]*grid-template-rows:\s*auto 1fr/s);
    expect(css).toMatch(/\.book-card-text\s*{[^}]*min-height:\s*calc\(\(var\(--line-height-callout\) \* var\(--book-title-lines\)\) \+ var\(--space-1\) \+ var\(--line-height-footnote\)\)/s);
    expect(css).toMatch(/\.book-card h3\s*{[^}]*-webkit-line-clamp:\s*var\(--book-title-lines\)/s);
  });

  it("reserves bottom space inside screens for the fixed bottom navigation", () => {
    expect(css).toMatch(/\.screen\s*{[^}]*padding:\s*var\(--space-5\) var\(--space-4\) calc\(var\(--nav-height\) \+ var\(--space-7\) \+ var\(--safe-area-bottom\)\)/s);
  });

  it("lays out the reader as fixed-height pages instead of vertical scrolling text", () => {
    expect(css).toContain("--reader-action-height: var(--control-height-sm)");
    expect(css).toContain("--reader-bottom-reserve: 0px");
    expect(css).toContain("--reader-page-gap: var(--space-4)");
    expect(css).toContain("--reader-font-size: 16px");
    expect(css).toContain("--reader-line-height: 1.5");
    expect(css).toMatch(/\.app-page-scroll-reader\s*{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.reader-screen\s*{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.reader-screen\s*{[^}]*height:\s*100%/s);
    expect(css).toMatch(/\.reader-screen\s*{[^}]*padding:\s*var\(--space-3\) var\(--space-4\) calc\(var\(--reader-bottom-reserve\) \+ var\(--space-2\) \+ var\(--safe-area-bottom\)\)/s);
    expect(css).toMatch(/\.reader-header\s*{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/s);
    expect(css).toMatch(/\.reader-title-block\s*{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.chapter-viewport\s*{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.chapter\s*{[^}]*column-width:\s*var\(--reader-page-width\)/s);
    expect(css).toMatch(/\.chapter\s*{[^}]*column-gap:\s*var\(--reader-page-gap\)/s);
    expect(css).toMatch(/\.icon-button\s*{[^}]*width:\s*var\(--reader-action-height\)/s);
  });

  it("keeps the fixed bottom navigation above cover rating badges", () => {
    expect(css).toContain("--z-cover-badge: 1");
    expect(css).toContain("--z-bottom-nav: 30");
    expect(css).toMatch(/\.book-rating-badge\s*{[^}]*z-index:\s*var\(--z-cover-badge\)/s);
    expect(css).toMatch(/\.bottom-nav\s*{[^}]*z-index:\s*var\(--z-bottom-nav\)/s);
  });
});
