import { describe, expect, it } from "vitest";
import { getReadableChapterState } from "./access.js";

describe("getReadableChapterState", () => {
  it("locks the fifth chapter without access", () => {
    expect(
      getReadableChapterState({
        chapterNumber: 5,
        totalChapters: 51,
        freeChapterLimit: 17,
        subscriptionUntil: null
      })
    ).toEqual({ canRead: false, reason: "paywall" });
  });
});
