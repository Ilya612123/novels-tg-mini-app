import { paywallDiscountWinbackOffers, type PaywallWinbackOffer } from "@novell-reader/shared";
import type { DbClient } from "../db.js";

export async function reserveNextPaywallWinbackOffer(db: DbClient, userId: string): Promise<PaywallWinbackOffer | null> {
  const shownOffers = await db.paywallWinbackImpression.findMany({
    where: { userId },
    select: { offerId: true }
  });
  const shownOfferIds = new Set(shownOffers.map((offer) => offer.offerId));
  const nextOffer = paywallDiscountWinbackOffers.find((offer) => !shownOfferIds.has(offer.id));
  if (!nextOffer) return null;

  await db.paywallWinbackImpression.upsert({
    where: { userId_offerId: { userId, offerId: nextOffer.id } },
    create: { userId, offerId: nextOffer.id },
    update: {}
  });

  return nextOffer;
}
