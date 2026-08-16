import { describe, expect, it } from "vitest";
import { findSubscriptionPlan, RUB_PER_TELEGRAM_STAR } from "./subscription.js";

describe("subscription pricing", () => {
  it("converts ruble subscription prices to Telegram Stars", () => {
    expect(RUB_PER_TELEGRAM_STAR).toBe(1.8);
    expect(findSubscriptionPlan("month")).toMatchObject({ priceLabel: "299₽", starsAmount: 167 });
    expect(findSubscriptionPlan("four-months")).toMatchObject({ priceLabel: "819₽", starsAmount: 455 });
    expect(findSubscriptionPlan("half-year")).toMatchObject({ priceLabel: "1499₽", starsAmount: 833 });
    expect(findSubscriptionPlan("year")).toMatchObject({ priceLabel: "2999₽", starsAmount: 1667 });
  });

  it("keeps winback prices in rubles and invoices their converted Stars amounts", () => {
    expect(findSubscriptionPlan("month-50-off")).toMatchObject({ priceLabel: "149₽", oldPrice: "299₽", starsAmount: 83 });
    expect(findSubscriptionPlan("month-75-off")).toMatchObject({ priceLabel: "75₽", oldPrice: "299₽", starsAmount: 42 });
  });
});
