import type { Payment } from "@prisma/client";
import type { DbClient } from "../db.js";

export async function createPendingPayment(
  db: DbClient,
  input: {
    userId: string;
    providerPayload: string;
    starsAmount: number;
  }
): Promise<Payment> {
  return db.payment.upsert({
    where: { providerPayload: input.providerPayload },
    create: {
      userId: input.userId,
      providerPayload: input.providerPayload,
      starsAmount: input.starsAmount,
      status: "pending"
    },
    update: {}
  });
}

export async function markPaymentPaid(
  db: DbClient,
  input: {
    providerPayload: string;
    rawPayload: unknown;
    paidAt?: Date;
  }
): Promise<Payment | null> {
  const existing = await db.payment.findUnique({ where: { providerPayload: input.providerPayload } });
  if (!existing) return null;
  if (existing.status === "paid") return existing;

  return db.payment.update({
    where: { providerPayload: input.providerPayload },
    data: {
      status: "paid",
      rawPayload: JSON.stringify(input.rawPayload),
      paidAt: input.paidAt ?? new Date()
    }
  });
}
