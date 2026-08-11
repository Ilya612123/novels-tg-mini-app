import fs from "node:fs/promises";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  ANALYTICS_CHANNEL_ID: "-1001",
  STARS_ACCESS_PRICE: 100,
  DATABASE_URL: "file:test.db",
  PORT: 3000
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
});
