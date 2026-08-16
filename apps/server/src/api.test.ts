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
let miniAppDistDir: string;

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
  miniAppDistDir = await mkdtemp(path.join(tmpdir(), "novell-reader-miniapp-"));
  await fs.mkdir(path.join(contentDir, "book-1", "chapters"), { recursive: true });
  await fs.mkdir(path.join(miniAppDistDir, "assets"), { recursive: true });
  await fs.writeFile(path.join(contentDir, "book-1", "chapters", "1.html"), "<p>Первая глава</p>");
  await fs.writeFile(path.join(contentDir, "book-1", "chapters", "18.html"), "<p>Платная глава</p>");
  await fs.writeFile(path.join(miniAppDistDir, "index.html"), '<html><body><div id="root"></div></body></html>');
  await fs.writeFile(path.join(miniAppDistDir, "assets", "app.js"), "console.log('miniapp');");
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
  await fs.rm(miniAppDistDir, { recursive: true, force: true });
});

describe("createApiServer", () => {
  it("lists books for dev Telegram user", async () => {
    const app = createApiServer({ config, db: testDb.db });
    const res = await request(app).get("/api/books").set("x-dev-telegram-user-id", "5100586818").expect(200);

    expect(res.body[0].title).toBe("Компенсация за первую любовь");
  });

  it("serves imported cover files from the configured content root", async () => {
    await fs.writeFile(path.join(contentDir, "book-1", "cover.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const app = createApiServer({ config, db: testDb.db, contentRoot: contentDir });

    const res = await request(app).get("/content/imported/book-1/cover.jpg").expect(200);

    expect(res.headers["content-type"]).toContain("image/jpeg");
  });

  it("serves imported images with long immutable cache headers", async () => {
    await fs.writeFile(path.join(contentDir, "book-1", "cover.webp"), Buffer.from("RIFFxxxxWEBP", "ascii"));
    const app = createApiServer({ config, db: testDb.db, contentRoot: contentDir });

    const res = await request(app).get("/content/imported/book-1/cover.webp").expect(200);

    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("serves the built Mini App index from the configured dist directory", async () => {
    const app = createApiServer({ config, db: testDb.db, miniAppDistDir });

    const res = await request(app).get("/").expect(200);

    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("serves built Mini App assets without intercepting API routes", async () => {
    const app = createApiServer({ config, db: testDb.db, miniAppDistDir });

    const asset = await request(app).get("/assets/app.js").expect(200);
    await request(app).get("/api").expect(404);
    await request(app).get("/api/books").expect(401);

    expect(asset.headers["content-type"]).toContain("javascript");
    expect(asset.text).toContain("miniapp");
  });

  it("returns paywall for paid chapter without access", async () => {
    const app = createApiServer({ config, db: testDb.db });
    const res = await request(app)
      .get("/api/books/book-1/chapters/18")
      .set("x-dev-telegram-user-id", "5100586818")
      .expect(402);

    expect(res.body).toEqual({ canRead: false, reason: "paywall" });
  });

  it("creates a Telegram Stars invoice for the selected subscription plan", async () => {
    const createInvoiceLink = vi.fn().mockResolvedValue("https://t.me/invoice");
    const app = createApiServer({
      config,
      db: testDb.db,
      bot: { api: { createInvoiceLink }, isRunning: () => false } as unknown as Bot
    });

    await request(app)
      .post("/api/payments/create")
      .set("x-dev-telegram-user-id", "5100586818")
      .send({ planId: "four-months" })
      .expect(200);

    expect(createInvoiceLink).toHaveBeenCalledWith(
      "Доступ к новеллам на 4 месяца",
      "Откройте продолжение всех новелл на 4 месяца.",
      expect.any(String),
      "",
      "XTR",
      [{ label: "4 месяца доступа", amount: 455 }]
    );
    await expect(testDb.db.payment.findFirstOrThrow()).resolves.toMatchObject({
      planId: "four-months",
      starsAmount: 455,
      accessDays: 120
    });
  });

  it("creates a discounted one-month Telegram Stars invoice for a winback plan", async () => {
    const createInvoiceLink = vi.fn().mockResolvedValue("https://t.me/invoice");
    const app = createApiServer({
      config,
      db: testDb.db,
      bot: { api: { createInvoiceLink }, isRunning: () => false } as unknown as Bot
    });

    await request(app)
      .post("/api/payments/create")
      .set("x-dev-telegram-user-id", "5100586818")
      .send({ planId: "month-50-off" })
      .expect(200);

    expect(createInvoiceLink).toHaveBeenCalledWith(
      "Доступ к новеллам на 30 дней со скидкой 50%",
      "Откройте продолжение всех новелл на 30 дней со скидкой 50%.",
      expect.any(String),
      "",
      "XTR",
      [{ label: "30 дней доступа со скидкой 50%", amount: 83 }]
    );
    await expect(testDb.db.payment.findFirstOrThrow()).resolves.toMatchObject({
      planId: "month-50-off",
      starsAmount: 83,
      accessDays: 30
    });
  });

  it("returns each discounted paywall winback offer only once per user", async () => {
    const app = createApiServer({ config, db: testDb.db });
    const first = await request(app).post("/api/paywall/winback-offers/next").set("x-dev-telegram-user-id", "5100586818").expect(200);
    const second = await request(app).post("/api/paywall/winback-offers/next").set("x-dev-telegram-user-id", "5100586818").expect(200);
    const third = await request(app).post("/api/paywall/winback-offers/next").set("x-dev-telegram-user-id", "5100586818").expect(200);

    expect(first.body.offer).toMatchObject({ id: "month-50-off", kind: "discount", planId: "month-50-off" });
    expect(second.body.offer).toMatchObject({ id: "month-75-off", kind: "discount", planId: "month-75-off" });
    expect(third.body.offer).toBeNull();
  });

  it("includes already issued discount offers in paywall plans", async () => {
    const app = createApiServer({ config, db: testDb.db });

    await request(app).post("/api/paywall/winback-offers/next").set("x-dev-telegram-user-id", "5100586818").expect(200);
    const res = await request(app).get("/api/paywall/plans").set("x-dev-telegram-user-id", "5100586818").expect(200);

    expect(res.body.plans.map((plan: { id: string }) => plan.id)).toEqual([
      "month",
      "four-months",
      "half-year",
      "year",
      "month-50-off"
    ]);
  });

  it("sets Telegram webhook and runtime Mini App URL in local dev", async () => {
    const setWebhook = vi.fn().mockResolvedValue(true);
    const localConfig = { ...config, BOT_MODE: "webhook" as const };
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

  it("updates runtime Mini App URL without setting webhook in polling mode", async () => {
    const setWebhook = vi.fn().mockResolvedValue(true);
    const localConfig = { ...config, BOT_MODE: "polling" as const };
    const app = createApiServer({
      config: localConfig,
      db: testDb.db,
      bot: { api: { setWebhook }, isRunning: () => false } as unknown as Bot
    });

    const res = await request(app).post("/dev/setup-webhook").send({ publicUrl: "https://reader.trycloudflare.com/" }).expect(200);

    expect(setWebhook).not.toHaveBeenCalled();
    expect(localConfig.MINI_APP_URL).toBe("https://reader.trycloudflare.com");
    expect(res.body).toEqual({
      ok: true,
      miniAppUrl: "https://reader.trycloudflare.com",
      webhookUrl: null
    });
  });

  it("does not register Telegram webhook route in polling mode", async () => {
    const app = createApiServer({
      config: { ...config, BOT_MODE: "polling" as const },
      db: testDb.db,
      bot: { api: {}, isRunning: () => false } as unknown as Bot
    });

    await request(app).post("/telegram/webhook").send({}).expect(404);
  });

  it("retries transient Telegram webhook DNS failures in local dev", async () => {
    const setWebhook = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: bad webhook: Failed to resolve host: Name or service not known"))
      .mockResolvedValueOnce(true);
    const localConfig = { ...config, BOT_MODE: "webhook" as const };
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

  it("keeps retrying Telegram webhook DNS failures long enough for fresh tunnel hosts", async () => {
    const transientFailure = new Error("Bad Request: bad webhook: Failed to resolve host: Name or service not known");
    const setWebhook = vi.fn();
    for (let attempt = 0; attempt < 75; attempt += 1) {
      setWebhook.mockRejectedValueOnce(transientFailure);
    }
    setWebhook.mockResolvedValueOnce(true);
    const app = createApiServer({
      config: { ...config, BOT_MODE: "webhook" as const },
      db: testDb.db,
      bot: { api: { setWebhook }, isRunning: () => false } as unknown as Bot,
      devWebhookRetryDelayMs: 0
    });

    await request(app).post("/dev/setup-webhook").send({ publicUrl: "https://reader.trycloudflare.com/" }).expect(200);

    expect(setWebhook).toHaveBeenCalledTimes(76);
  });

  it("retries Telegram webhook rate limits in local dev", async () => {
    const rateLimitError = Object.assign(new Error("Too Many Requests: retry after 1"), {
      error_code: 429,
      parameters: { retry_after: 1 }
    });
    const setWebhook = vi.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(true);
    const app = createApiServer({
      config: { ...config, BOT_MODE: "webhook" as const },
      db: testDb.db,
      bot: { api: { setWebhook }, isRunning: () => false } as unknown as Bot,
      devWebhookRetryDelayMs: 0
    });

    await request(app).post("/dev/setup-webhook").send({ publicUrl: "https://reader.trycloudflare.com/" }).expect(200);

    expect(setWebhook).toHaveBeenCalledTimes(2);
  });
});
