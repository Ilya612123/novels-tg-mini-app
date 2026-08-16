export const RUB_PER_TELEGRAM_STAR = 1.8;

function rublesToTelegramStars(rubles: number) {
  return Math.ceil(rubles / RUB_PER_TELEGRAM_STAR);
}

export const subscriptionPlans = [
  {
    id: "month",
    title: "Месяц",
    priceLabel: "299₽",
    starsAmount: rublesToTelegramStars(299),
    durationDays: 30,
    period: "1 месяц",
    oldPrice: null,
    discount: null,
    badge: null,
    invoiceTitle: "Доступ к новеллам на 30 дней",
    invoiceDescription: "Откройте продолжение всех новелл на 30 дней.",
    invoiceLabel: "30 дней доступа",
    paywallVisible: true
  },
  {
    id: "four-months",
    title: "4 месяца",
    priceLabel: "819₽",
    starsAmount: rublesToTelegramStars(819),
    durationDays: 120,
    period: "205₽/мес",
    oldPrice: "1196₽",
    discount: "Скидка 31%",
    badge: "Лучший выбор",
    invoiceTitle: "Доступ к новеллам на 4 месяца",
    invoiceDescription: "Откройте продолжение всех новелл на 4 месяца.",
    invoiceLabel: "4 месяца доступа",
    paywallVisible: true
  },
  {
    id: "half-year",
    title: "Полгода",
    priceLabel: "1499₽",
    starsAmount: rublesToTelegramStars(1499),
    durationDays: 180,
    period: "250₽/мес",
    oldPrice: "1794₽",
    discount: "Скидка 16%",
    badge: null,
    invoiceTitle: "Доступ к новеллам на полгода",
    invoiceDescription: "Откройте продолжение всех новелл на полгода.",
    invoiceLabel: "Полгода доступа",
    paywallVisible: true
  },
  {
    id: "year",
    title: "Год",
    priceLabel: "2999₽",
    starsAmount: rublesToTelegramStars(2999),
    durationDays: 365,
    period: "250₽/мес",
    oldPrice: "3588₽",
    discount: "Скидка 16%",
    badge: "Максимум доступа",
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
  },
  {
    id: "month-75-off",
    title: "Месяц -75%",
    priceLabel: "75₽",
    starsAmount: rublesToTelegramStars(75),
    durationDays: 30,
    period: "1 месяц",
    oldPrice: "299₽",
    discount: "Скидка 75%",
    badge: null,
    invoiceTitle: "Доступ к новеллам на 30 дней со скидкой 75%",
    invoiceDescription: "Откройте продолжение всех новелл на 30 дней со скидкой 75%.",
    invoiceLabel: "30 дней доступа со скидкой 75%",
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
  },
  {
    id: "month-75-off",
    kind: "discount",
    title: "1 месяц со скидкой 75%",
    body: "Последнее предложение: 30 дней доступа с максимальной скидкой.",
    buttonLabel: "Купить за 75₽",
    planId: "month-75-off"
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
