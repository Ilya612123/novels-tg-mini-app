import { describe, expect, it } from "vitest";
import { calculateFreeChapterLimit, canReadChapter } from "./access.js";

describe("calculateFreeChapterLimit", () => {
  it("limits free access to the first four chapters", () => {
    expect(calculateFreeChapterLimit(51)).toBe(4);
    expect(calculateFreeChapterLimit(10)).toBe(4);
  });

  it("caps stored manual limits at four chapters", () => {
    expect(calculateFreeChapterLimit(51, 12)).toBe(4);
  });

  it("keeps shorter books within their chapter count", () => {
    expect(calculateFreeChapterLimit(3)).toBe(3);
  });
});

describe("canReadChapter", () => {
  it("allows free chapters without access", () => {
    expect(canReadChapter({ chapterNumber: 4, totalChapters: 51, subscriptionUntil: null })).toBe(true);
  });

  it("blocks paid chapters without active access", () => {
    expect(canReadChapter({ chapterNumber: 5, totalChapters: 51, subscriptionUntil: null })).toBe(false);
  });

  it("blocks the fifth chapter even when a larger stored free limit exists", () => {
    expect(canReadChapter({ chapterNumber: 5, totalChapters: 51, manualFreeChapterLimit: 17, subscriptionUntil: null })).toBe(false);
  });

  it("allows paid chapters with active access", () => {
    expect(
      canReadChapter({
        chapterNumber: 5,
        totalChapters: 51,
        subscriptionUntil: new Date("2030-01-01T00:00:00.000Z"),
        now: new Date("2029-12-01T00:00:00.000Z")
      })
    ).toBe(true);
  });
});
