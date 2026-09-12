import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import type { AppConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { extendAccessByDays } from "./repositories/access.js";
import { recordAnalyticsEvent } from "./repositories/analytics.js";
import { recordBotStartEvent } from "./repositories/botStarts.js";
import { markPaymentPaid } from "./repositories/payments.js";
import { upsertTelegramUser } from "./repositories/users.js";

export type BotDeps = {
  config: AppConfig;
  db: DbClient;
};

const START_MESSAGE_TEXT = `Привет. Тут истории про запретные чувства, одержимость, ревность и любовь, от которой сложно оторваться.

Начни с первой главы — если не зацепит, просто выберешь другую.`;

const START_PHOTO_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "bot", "start.jpg");

function withMiniAppParams(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function createBot(deps: BotDeps): Bot {
  const bot = new Bot(deps.config.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    await upsertTelegramUser(deps.db, {
      id: String(from.id),
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null
    });
    const botStartEvent = await recordBotStartEvent(deps.db, {
      userId: String(from.id),
      username: from.username ?? null
    });

    await recordAnalyticsEvent(deps.db, {
      userId: String(from.id),
      username: from.username ?? null,
      source: "bot",
      label: "старт бота",
      metadata: { botStartEventId: botStartEvent.id }
    });

    const keyboard = new InlineKeyboard()
      .webApp("📚 Открыть каталог", deps.config.MINI_APP_URL)
      .row()
      .webApp("Случайная книга", withMiniAppParams(deps.config.MINI_APP_URL, { random: "1" }))
      .row()
      .url("Поддержка", deps.config.SUPPORT_URL);

    await ctx.replyWithPhoto(new InputFile(START_PHOTO_PATH), {
      caption: START_MESSAGE_TEXT,
      reply_markup: keyboard
    });
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const from = ctx.from;
    const payment = ctx.message.successful_payment;
    if (!from || !payment) return;

    const markedPayment = await markPaymentPaid(deps.db, {
      providerPayload: payment.invoice_payload,
      rawPayload: payment
    });

    if (!markedPayment) return;
    await extendAccessByDays(deps.db, String(from.id), markedPayment.accessDays);
    await recordAnalyticsEvent(deps.db, {
      userId: String(from.id),
      username: from.username ?? null,
      source: "bot",
      label: "оплата успешна",
      metadata: { providerPayload: payment.invoice_payload }
    });
  });

  return bot;
}
