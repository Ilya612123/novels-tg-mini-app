import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { webhookCallback, type Bot } from "grammy";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { requireTelegramUser } from "./auth.js";
import { HttpError } from "./httpErrors.js";
import { listBooksForUser, getBookDetailForUser, getChapterForUser } from "./services/books.js";
import { saveProgress } from "./services/progress.js";
import { createAnalyticsEvent } from "./services/analytics.js";
import { createAccessInvoiceLink } from "./services/payments.js";

export type ApiDeps = {
  config: AppConfig;
  db: DbClient;
  bot?: Bot;
  devWebhookRetryDelayMs?: number;
};

const ProgressSchema = z.object({
  bookId: z.string().min(1),
  chapterNumber: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100).nullable()
});

const AnalyticsSchema = z.object({
  label: z.string().min(1),
  metadata: z.unknown().optional()
});

const DevWebhookSetupSchema = z.object({
  publicUrl: z.string().url()
});

const DEV_WEBHOOK_SETUP_ATTEMPTS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientWebhookResolutionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /bad webhook/i.test(message) && /failed to resolve host/i.test(message);
}

async function setDevTelegramWebhook(bot: Bot, webhookUrl: string, retryDelayMs: number) {
  for (let attempt = 1; attempt <= DEV_WEBHOOK_SETUP_ATTEMPTS; attempt += 1) {
    try {
      await bot.api.setWebhook(webhookUrl);
      return;
    } catch (error) {
      if (attempt === DEV_WEBHOOK_SETUP_ATTEMPTS || !isTransientWebhookResolutionError(error)) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function createApiServer(deps: ApiDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/content/imported", express.static("content/imported"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  if (deps.bot) {
    app.post("/telegram/webhook", webhookCallback(deps.bot, "express"));
  }

  app.post(
    "/dev/setup-webhook",
    asyncRoute(async (req, res) => {
      if (process.env.NODE_ENV === "production") {
        throw new HttpError(404, "Маршрут доступен только локально");
      }
      if (!deps.bot) throw new HttpError(503, "Бот недоступен для настройки webhook");

      const body = DevWebhookSetupSchema.parse(req.body);
      const publicUrl = body.publicUrl.replace(/\/$/, "");
      const webhookUrl = `${publicUrl}/telegram/webhook`;
      deps.config.MINI_APP_URL = publicUrl;
      deps.config.PUBLIC_BASE_URL = publicUrl;
      await setDevTelegramWebhook(deps.bot, webhookUrl, deps.devWebhookRetryDelayMs ?? 1000);
      res.json({ ok: true, miniAppUrl: deps.config.MINI_APP_URL, webhookUrl });
    })
  );

  app.get(
    "/api/books",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      res.json(await listBooksForUser(deps.db, user.id));
    })
  );

  app.get(
    "/api/books/:bookId",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      const book = await getBookDetailForUser(deps.db, user.id, req.params.bookId);
      if (!book) throw new HttpError(404, "Книга не найдена");
      res.json(book);
    })
  );

  app.get(
    "/api/books/:bookId/chapters/:chapterNumber",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      const chapterNumber = Number(req.params.chapterNumber);
      if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
        throw new HttpError(400, "Некорректный номер главы");
      }

      const chapter = await getChapterForUser(deps.db, user.id, req.params.bookId, chapterNumber);
      if (!chapter) throw new HttpError(404, "Глава не найдена");
      if (!chapter.canRead) {
        res.status(402).json(chapter);
        return;
      }
      res.json(chapter);
    })
  );

  app.post(
    "/api/progress",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      const body = ProgressSchema.parse(req.body);
      res.json(await saveProgress(deps.db, { ...body, userId: user.id }));
    })
  );

  app.post(
    "/api/analytics",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      const body = AnalyticsSchema.parse(req.body);
      await createAnalyticsEvent(deps.db, {
        userId: user.id,
        username: user.username,
        source: "miniapp",
        label: body.label,
        metadata: body.metadata
      });
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/payments/create",
    asyncRoute(async (req, res) => {
      const user = await requireTelegramUser(deps.db, req, deps.config.BOT_TOKEN);
      if (!deps.bot) throw new HttpError(503, "Бот недоступен для создания платежа");
      res.json(await createAccessInvoiceLink({ bot: deps.bot, db: deps.db, config: deps.config, userId: user.id }));
    })
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Некорректные данные", details: error.flatten() });
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  });

  return app;
}
