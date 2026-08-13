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
  });

  it("uses typography tokens for core miniapp surfaces", () => {
    expect(css).toMatch(/h1\s*{[^}]*font-size:\s*var\(--font-size-title-1\)/s);
    expect(css).toMatch(/\.primary-button\s*{[^}]*font-size:\s*var\(--font-size-callout\)/s);
    expect(css).toMatch(/\.text-button\s*{[^}]*font-size:\s*var\(--font-size-callout\)/s);
    expect(css).toMatch(/\.chapter\s*{[^}]*font-size:\s*var\(--reader-font-size\)/s);
    expect(css).toMatch(/\.winback-modal h2\s*{[^}]*font-size:\s*var\(--font-size-title-1\)/s);
    expect(css).not.toMatch(/font-weight:\s*(800|900)\b/);
  });
});
