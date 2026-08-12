import fs from "node:fs/promises";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot } from "grammy";
import { createApiServer } from "./api.js";
import type { AppConfig } from "./config.js";
import type { TestDb } from "./test/db.js";
import { createTestDb } from "./test/db.js";

let testDb: TestDb;
let contentDir: string;

const config: AppConfig = {
  BOT_TOKEN: "token",
  MINI_APP_URL: "https://example.com/app",
  SUPPORT_URL: "https://t.me/esimsmile_support",
  ANALYTICS_USER_ID: "5100586818",
  STARS_ACCESS_PRICE: 100,
  DATABASE_URL: "file:test.db",
  PORT: 3000,
  BOT_MODE: "polling"
};

beforeEach(async () => {
  testDb = await createTestDb();
  contentDir = await mkdtemp(path.join(tmpdir(), "novell-reader-content-"));
  await fs.mkdir(path.join(contentDir, "book-1", "chapters"), { recursive: true });
  await fs.writeFile(path.join(contentDir, "book-1", "chapters", "1.html"), "<p>Первая глава</p>");
  await fs.writeFile(path.join(contentDir, "book-1", "chapters", "18.html"), "<p>Платная глава</p>");
  await testDb.db.book.create({
    data: {
      id: "book-1",
      title: "Компенсация за первую любовь",
      chapterCount: 51,
      freeChapterLimit: 17,
      sourceEpubFile: "sample.epub",
      chapters: {
        createMany: {
          data: [
            { id: "book-1-1", number: 1, title: "Глава 1", contentPath: "book-1/chapters/1.html" },
            { id: "book-1-18", number: 18, title: "Глава 18", contentPath: "book-1/chapters/18.html" }
          ]
        }
      }
    }
  });
});

afterEach(async () => {
  await testDb?.cleanup();
  await fs.rm(contentDir, { recursive: true, force: true });
});

describe("createApiServer", () => {
  it("lists books for dev Telegram user", async () => {
    const app = createApiServer({ config, db: testDb.db });
    const res = await request(app).get("/api/books").set("x-dev-telegram-user-id", "5100586818").expect(200);

    expect(res.body[0].title).toBe("Компенсация за первую любовь");
  });

  it("returns paywall for paid chapter without access", async () => {
    const app = createApiServer({ config, db: testDb.db });
    const res = await request(app)
      .get("/api/books/book-1/chapters/18")
      .set("x-dev-telegram-user-id", "5100586818")
      .expect(402);

    expect(res.body).toEqual({ canRead: false, reason: "paywall" });
  });

  it("sets Telegram webhook and runtime Mini App URL in local dev", async () => {
    const setWebhook = vi.fn().mockResolvedValue(true);
    const localConfig = { ...config };
    const app = createApiServer({
      config: localConfig,
      db: testDb.db,
      bot: { api: { setWebhook }, isRunning: () => false } as unknown as Bot
    });

    const res = await request(app).post("/dev/setup-webhook").send({ publicUrl: "https://reader.trycloudflare.com/" }).expect(200);

    expect(setWebhook).toHaveBeenCalledWith("https://reader.trycloudflare.com/telegram/webhook");
    expect(localConfig.MINI_APP_URL).toBe("https://reader.trycloudflare.com");
    expect(res.body).toEqual({
      ok: true,
      miniAppUrl: "https://reader.trycloudflare.com",
      webhookUrl: "https://reader.trycloudflare.com/telegram/webhook"
    });
  });

  it("retries transient Telegram webhook DNS failures in local dev", async () => {
    const setWebhook = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: bad webhook: Failed to resolve host: Name or service not known"))
      .mockResolvedValueOnce(true);
    const localConfig = { ...config };
    const app = createApiServer({
      config: localConfig,
      db: testDb.db,
      bot: { api: { setWebhook }, isRunning: () => false } as unknown as Bot,
      devWebhookRetryDelayMs: 0
    });

    const res = await request(app)
      .post("/dev/setup-webhook")
      .send({ publicUrl: "https://reader.trycloudflare.com/" })
      .expect(200);

    expect(setWebhook).toHaveBeenCalledTimes(2);
    expect(setWebhook).toHaveBeenNthCalledWith(1, "https://reader.trycloudflare.com/telegram/webhook");
    expect(setWebhook).toHaveBeenNthCalledWith(2, "https://reader.trycloudflare.com/telegram/webhook");
    expect(res.body.webhookUrl).toBe("https://reader.trycloudflare.com/telegram/webhook");
  });
});
