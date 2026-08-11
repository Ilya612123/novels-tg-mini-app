import type { Bot } from "grammy";
import type { AppConfig } from "../config.js";

export async function createAccessInvoiceLink(input: {
  bot: Bot;
  config: AppConfig;
  userId: string;
}): Promise<{ invoiceLink: string; providerPayload: string }> {
  const providerPayload = `access:${input.userId}:${Date.now()}`;
  const invoiceLink = await input.bot.api.createInvoiceLink(
    "Доступ к новеллам на 30 дней",
    "Откройте продолжение всех новелл на 30 дней.",
    providerPayload,
    "",
    "XTR",
    [{ label: "30 дней доступа", amount: input.config.STARS_ACCESS_PRICE }]
  );

  return { invoiceLink, providerPayload };
}
