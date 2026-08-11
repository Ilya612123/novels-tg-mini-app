import { describe, expect, it } from "vitest";
import { getReadableChapterState } from "./access.js";

describe("getReadableChapterState", () => {
  it("locks chapter after free limit without access", () => {
    expect(
      getReadableChapterState({
        chapterNumber: 18,
        totalChapters: 51,
        freeChapterLimit: 17,
        subscriptionUntil: null
      })
    ).toEqual({ canRead: false, reason: "paywall" });
  });
});
