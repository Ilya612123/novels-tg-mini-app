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
        },
        {
          userId: "5100586818",
          username: "barboruss",
          occurredAt: new Date("2026-08-11T09:21:34.000Z"),
          label: "искал в Каталоге",
          metadata: { query: "баш", resultCount: 1 },
          source: "miniapp"
        }
      ]
    });

    expect(text).toContain("Логи за 12:21-12:22");
    expect(text).toContain("user 5100586818 @barboruss");
    expect(text).toContain("12:21:03 старт бота");
    expect(text).toContain("12:21:34 искал в Каталоге query=баш resultCount=1");
    expect(text).toContain("активность в mini app: 23 сек");
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

  it("formats reader analytics for Telegram without raw metadata keys", () => {
    const text = formatAnalyticsBatch({
      from: new Date("2026-08-11T09:21:00.000Z"),
      to: new Date("2026-08-11T09:22:00.000Z"),
      events: [
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:03.000Z"),
          label: "открыл главу",
          metadata: { bookId: "book-1", bookTitle: "Название книги", chapterNumber: 12, chapterTitle: "Название главы" },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:04.000Z"),
          label: "загрузка главы завершилась",
          metadata: { bookId: "book-1", bookTitle: "Название книги", chapterNumber: 12, durationMs: 842, status: "success" },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:10.000Z"),
          label: "читает главу 12",
          metadata: { bookId: "book-1", bookTitle: "Название книги", chapterNumber: 12, percent: 10 },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:18.000Z"),
          label: "нажал вперед",
          metadata: { bookId: "book-1", fromChapterNumber: 12, toChapterNumber: 13 },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:20.000Z"),
          label: "загрузка главы завершилась",
          metadata: { bookId: "book-1", bookTitle: "Название книги", chapterNumber: 13, durationMs: 1400, status: "success" },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:30.000Z"),
          label: "нажал назад",
          metadata: { bookId: "book-1", fromChapterNumber: 13, toChapterNumber: 12 },
          source: "miniapp"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:40.000Z"),
          label: "вышел из чтения главы",
          metadata: { bookId: "book-1", bookTitle: "Название книги", chapterNumber: 12 },
          source: "miniapp"
        }
      ]
    });

    expect(text).toContain("user 639435736 @username");
    expect(text).toContain("Открыл главу 12 «Название главы» в «Название книги»");
    expect(text).toContain("Глава 12 загрузилась за 842 мс");
    expect(text).toContain("Читает главу 12: 10%");
    expect(text).toContain("Нажал вперед: глава 12 -> 13");
    expect(text).toContain("Глава 13 загрузилась за 1.4 сек");
    expect(text).toContain("Нажал назад: глава 13 -> 12");
    expect(text).toContain("Вышел из чтения главы 12 в «Название книги»");
    expect(text).not.toContain("bookId=");
    expect(text).not.toContain("fromChapterNumber=");
    expect(text).not.toContain("toChapterNumber=");
  });

  it("formats push analytics for Telegram without noisy metadata", () => {
    const text = formatAnalyticsBatch({
      from: new Date("2026-08-11T09:21:00.000Z"),
      to: new Date("2026-08-11T09:22:00.000Z"),
      events: [
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:03.000Z"),
          label: "push_scheduled",
          metadata: {
            scenario: "inactive_reader",
            templateId: "inactive_reader_v1",
            messageText: "Продолжить чтение?",
            bookId: "book-1",
            bookTitle: "Название книги",
            chapterNumber: 12,
            scheduledAt: "2026-08-11T09:21:03.000Z",
            progressUpdatedAt: "2026-08-10T09:21:03.000Z"
          },
          source: "bot"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:04.000Z"),
          label: "push_sent",
          metadata: {
            scenario: "inactive_reader",
            templateId: "inactive_reader_v1",
            messageText: "Продолжить чтение?",
            bookId: "book-1",
            bookTitle: "Название книги",
            chapterNumber: 12,
            sentAt: "2026-08-11T09:21:04.000Z",
            deepLink: "https://reader.example.test/?bookId=book-1&chapter=12&push=inactive_reader_v1"
          },
          source: "bot"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:05.000Z"),
          label: "push_suppressed_duplicate",
          metadata: {
            scenario: "inactive_reader",
            templateId: "inactive_reader_v1",
            messageText: "Продолжить чтение?",
            bookId: "book-1",
            bookTitle: "Название книги",
            chapterNumber: 12,
            suppressionReason: "duplicate_recently_sent"
          },
          source: "bot"
        },
        {
          userId: "639435736",
          username: "username",
          occurredAt: new Date("2026-08-11T09:21:06.000Z"),
          label: "push_failed",
          metadata: {
            scenario: "inactive_reader",
            templateId: "inactive_reader_v1",
            messageText: "Продолжить чтение?",
            failureReason: "Forbidden: bot was blocked by the user"
          },
          source: "bot"
        }
      ]
    });

    expect(text).toContain("Запланировали пуш по «Название книги», глава 12: «Продолжить чтение?»");
    expect(text).toContain("Пуш отправлен по «Название книги», глава 12: «Продолжить чтение?»");
    expect(text).toContain("Пуш не отправлен по «Название книги», глава 12: пользователь недавно получал такой пуш");
    expect(text).toContain("Пуш не отправился: Forbidden: bot was blocked by the user");
    expect(text).not.toContain("scenario=");
    expect(text).not.toContain("templateId=");
    expect(text).not.toContain("deepLink=");
    expect(text).not.toContain("progressUpdatedAt=");
    expect(text).not.toContain("bookId=");
  });
});
