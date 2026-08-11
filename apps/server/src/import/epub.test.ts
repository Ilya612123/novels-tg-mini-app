import { describe, expect, it } from "vitest";
import { extractChapterNumber, shouldSkipChapterTitle } from "./epub.js";

describe("EPUB import helpers", () => {
  it("keeps real chapters and skips service pages", () => {
    expect(shouldSkipChapterTitle("Глава 51. Экстра")).toBe(false);
    expect(shouldSkipChapterTitle("Информация о книге")).toBe(true);
  });

  it("extracts chapter numbers from titles", () => {
    expect(extractChapterNumber("Глава 17")).toBe(17);
    expect(extractChapterNumber("Глава 51. Экстра")).toBe(51);
  });
});
