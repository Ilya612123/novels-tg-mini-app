import { describe, expect, it } from "vitest";
import { calculateFreeChapterLimit, canReadChapter } from "./access.js";

describe("calculateFreeChapterLimit", () => {
  it("rounds the first third up", () => {
    expect(calculateFreeChapterLimit(51)).toBe(17);
    expect(calculateFreeChapterLimit(10)).toBe(4);
  });

  it("uses a manual limit when present", () => {
    expect(calculateFreeChapterLimit(51, 12)).toBe(12);
  });
});

describe("canReadChapter", () => {
  it("allows free chapters without access", () => {
    expect(canReadChapter({ chapterNumber: 17, totalChapters: 51, subscriptionUntil: null })).toBe(true);
  });

  it("blocks paid chapters without active access", () => {
    expect(canReadChapter({ chapterNumber: 18, totalChapters: 51, subscriptionUntil: null })).toBe(false);
  });

  it("allows paid chapters with active access", () => {
    expect(
      canReadChapter({
        chapterNumber: 18,
        totalChapters: 51,
        subscriptionUntil: new Date("2030-01-01T00:00:00.000Z"),
        now: new Date("2029-12-01T00:00:00.000Z")
      })
    ).toBe(true);
  });
});
