import type { Bot } from "grammy";
import { findSubscriptionPlan, type SubscriptionPlanId } from "@novell-reader/shared";
import type { DbClient } from "../db.js";
import { createPendingPayment } from "../repositories/payments.js";
import { HttpError } from "../httpErrors.js";

export async function createAccessInvoiceLink(input: {
  bot: Bot;
  db: DbClient;
  userId: string;
  planId: SubscriptionPlanId;
}): Promise<{ invoiceLink: string; providerPayload: string }> {
  const plan = findSubscriptionPlan(input.planId);
  if (!plan) throw new HttpError(400, "Неизвестный тариф подписки");

  const providerPayload = `access:${input.userId}:${Date.now()}`;
  await createPendingPayment(input.db, {
    userId: input.userId,
    providerPayload,
    planId: plan.id,
    accessDays: plan.durationDays,
    starsAmount: plan.starsAmount
  });

  const invoiceLink = await input.bot.api.createInvoiceLink(
    plan.invoiceTitle,
    plan.invoiceDescription,
    providerPayload,
    "",
    "XTR",
    [{ label: plan.invoiceLabel, amount: plan.starsAmount }]
  );

  return { invoiceLink, providerPayload };
}
