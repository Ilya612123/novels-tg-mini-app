import { describe, expect, it } from "vitest";
import { formatAnalyticsBatch } from "./analytics.js";

describe("formatAnalyticsBatch", () => {
  it("formats grouped user events", () => {
    const text = formatAnalyticsBatch({
      from: new Date("2026-08-11T09:21:00.000Z"),
      to: new Date("2026-08-11T09:22:00.000Z"),
      events: [
        {
          userId: "5100586818",
          username: "barboruss",
          occurredAt: new Date("2026-08-11T09:21:03.000Z"),
          label: "старт бота",
          source: "bot"
        },
        {
          userId: "5100586818",
          username: "barboruss",
          occurredAt: new Date("2026-08-11T09:21:11.000Z"),
          label: "открыл Mini App",
          source: "miniapp"
        },
        {
          userId: "5100586818",
          username: "barboruss",
          occurredAt: new Date("2026-08-11T09:21:24.000Z"),
          label: "начал читать Главу 1",
          source: "miniapp"
        }
      ]
    });

    expect(text).toContain("Логи за 12:21-12:22");
    expect(text).toContain("user 5100586818 @barboruss");
    expect(text).toContain("12:21:03 старт бота");
    expect(text).toContain("активность в mini app: 13 сек");
  });

  it("returns null without events", () => {
    expect(
      formatAnalyticsBatch({
        from: new Date("2026-08-11T09:21:00.000Z"),
        to: new Date("2026-08-11T09:22:00.000Z"),
        events: []
      })
    ).toBeNull();
  });
});
