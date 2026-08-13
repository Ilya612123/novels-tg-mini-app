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

  it("keeps the fixed bottom navigation above cover rating badges", () => {
    expect(css).toContain("--z-cover-badge: 1");
    expect(css).toContain("--z-bottom-nav: 30");
    expect(css).toMatch(/\.book-rating-badge\s*{[^}]*z-index:\s*var\(--z-cover-badge\)/s);
    expect(css).toMatch(/\.bottom-nav\s*{[^}]*z-index:\s*var\(--z-bottom-nav\)/s);
  });
});
