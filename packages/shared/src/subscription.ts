export const RUB_PER_TELEGRAM_STAR = 1.8;

function rublesToTelegramStars(rubles: number) {
  return Math.ceil(rubles / RUB_PER_TELEGRAM_STAR);
}

export const subscriptionPlans = [
  {
    id: "week",
    title: "Недельный VIP",
    priceLabel: "99₽",
    starsAmount: rublesToTelegramStars(99),
    durationDays: 7,
    period: "400₽/мес",
    oldPrice: null,
    discount: null,
    badge: null,
    invoiceTitle: "Доступ к новеллам на 7 дней",
    invoiceDescription: "Откройте продолжение всех новелл на 7 дней.",
    invoiceLabel: "7 дней доступа",
    paywallVisible: true
  },
  {
    id: "month",
    title: "Месячный VIP",
    priceLabel: "299₽",
    starsAmount: rublesToTelegramStars(299),
    durationDays: 30,
    period: "299₽/мес",
    oldPrice: null,
    discount: null,
    badge: null,
    invoiceTitle: "Доступ к новеллам на 30 дней",
    invoiceDescription: "Откройте продолжение всех новелл на 30 дней.",
    invoiceLabel: "30 дней доступа",
    paywallVisible: true
  },
  {
    id: "year",
    title: "Годовой VIP",
    priceLabel: "2999₽",
    starsAmount: rublesToTelegramStars(2999),
    durationDays: 365,
    period: "250₽/мес",
    oldPrice: null,
    discount: null,
    badge: null,
    invoiceTitle: "Доступ к новеллам на год",
    invoiceDescription: "Откройте продолжение всех новелл на год.",
    invoiceLabel: "Год доступа",
    paywallVisible: true
  },
  {
    id: "month-50-off",
    title: "Месяц -50%",
    priceLabel: "149₽",
    starsAmount: rublesToTelegramStars(149),
    durationDays: 30,
    period: "1 месяц",
    oldPrice: "299₽",
    discount: "Скидка 50%",
    badge: null,
    invoiceTitle: "Доступ к новеллам на 30 дней со скидкой 50%",
    invoiceDescription: "Откройте продолжение всех новелл на 30 дней со скидкой 50%.",
    invoiceLabel: "30 дней доступа со скидкой 50%",
    paywallVisible: false
  }
] as const;

export type SubscriptionPlanId = (typeof subscriptionPlans)[number]["id"];
export type SubscriptionPlan = (typeof subscriptionPlans)[number];

export const publicSubscriptionPlans = subscriptionPlans.filter((plan) => plan.paywallVisible);

export const starsHelpWinbackOffer = {
  id: "stars-help",
  kind: "premium-bot",
  title: "Не хватает Stars?",
  body: "Пополните баланс через PremiumBot, вернитесь сюда и попробуйте оплатить тариф еще раз.",
  buttonLabel: "Купить Stars в PremiumBot"
} as const;

export const paywallDiscountWinbackOffers = [
  {
    id: "month-50-off",
    kind: "discount",
    title: "1 месяц со скидкой 50%",
    body: "Откройте все платные главы на 30 дней по специальной цене.",
    buttonLabel: "Купить за 149₽",
    planId: "month-50-off"
  }
] as const;

export const paywallWinbackOffers = [starsHelpWinbackOffer, ...paywallDiscountWinbackOffers] as const;

export type PaywallWinbackOfferId = (typeof paywallWinbackOffers)[number]["id"];
export type PaywallWinbackOffer = (typeof paywallWinbackOffers)[number];

export function findSubscriptionPlan(planId: string | null | undefined) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? null;
}

export function findPaywallWinbackOffer(offerId: string | null | undefined) {
  return paywallWinbackOffers.find((offer) => offer.id === offerId) ?? null;
}
