import { Bot, InlineKeyboard } from "grammy";
import type { AppConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { extendAccessByThirtyDays } from "./repositories/access.js";
import { recordAnalyticsEvent } from "./repositories/analytics.js";
import { markPaymentPaid } from "./repositories/payments.js";
import { upsertTelegramUser } from "./repositories/users.js";

export type BotDeps = {
  config: AppConfig;
  db: DbClient;
};

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

    await recordAnalyticsEvent(deps.db, {
      userId: String(from.id),
      username: from.username ?? null,
      source: "bot",
      label: "старт бота"
    });

    const keyboard = new InlineKeyboard()
      .webApp("Книги", deps.config.MINI_APP_URL)
      .url("Поддержка", deps.config.SUPPORT_URL);

    await ctx.reply("Откройте каталог новелл или напишите в поддержку.", { reply_markup: keyboard });
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
    await extendAccessByThirtyDays(deps.db, String(from.id));
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
