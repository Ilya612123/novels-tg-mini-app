import { useEffect, useState } from "react";
import { BookOpen, Crown, Download, Headphones, Sparkles, WifiOff } from "lucide-react";
import { type SubscriptionPlan, type SubscriptionPlanId } from "@novell-reader/shared";

const premiumBenefits = [
  { icon: BookOpen, label: "доступ ко всем главам" },
  { icon: Download, label: "скачивание новелл" },
  { icon: WifiOff, label: "офлайн чтение" },
  { icon: Sparkles, label: "эксклюзивные новеллы" },
  { icon: Headphones, label: "ВИП поддержка" }
];

const planPricePeriods: Partial<Record<SubscriptionPlanId, string>> = {
  week: "нед",
  month: "мес",
  year: "год",
  "month-50-off": "мес"
};

export function PaywallScreen({
  paymentStatusMessage,
  onBack,
  onBuy,
  plans
}: {
  paymentStatusMessage?: string | null;
  onBack: () => void;
  onBuy: (planId: SubscriptionPlanId) => void;
  plans: SubscriptionPlan[];
}) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(plans[0]);

  useEffect(() => {
    if (!plans.some((plan) => plan.id === selectedPlan.id)) {
      setSelectedPlan(plans[0]);
    }
  }, [plans, selectedPlan.id]);

  return (
    <main className="screen paywall-screen">
      <header className="paywall-header">
        <button className="text-button" onClick={onBack} type="button">
          Назад
        </button>
        <h1>VIP</h1>
      </header>

      {paymentStatusMessage && <p className="paywall-payment-status">{paymentStatusMessage}</p>}

      <section className="paywall-premium-intro" aria-labelledby="paywall-premium-title">
        <h2 className="paywall-benefits-title" id="paywall-premium-title">
          <Crown aria-hidden="true" size={22} />
          Преимущества Premium
        </h2>
        <ul className="paywall-benefits-list">
          {premiumBenefits.map(({ icon: Icon, label }) => (
            <li className="paywall-benefit" key={label}>
              <span className="paywall-benefit-icon" aria-hidden="true">
                <Icon size={9} />
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="subscription-plans" role="radiogroup" aria-label="Тарифы подписки">
        {plans.map((plan) => (
          <label className={`subscription-plan${selectedPlan.id === plan.id ? " subscription-plan-selected" : ""}`} key={plan.id}>
            <input
              checked={selectedPlan.id === plan.id}
              className="subscription-plan-radio"
              name="subscription-plan"
              onChange={() => setSelectedPlan(plan)}
              type="radio"
            />
            {plan.badge && <span className="subscription-badge">{plan.badge}</span>}
            <span className="subscription-plan-copy">
              <strong>{plan.title}</strong>
              <small>{plan.period}</small>
              {plan.discount && <span className="subscription-discount">{plan.discount}</span>}
            </span>
            <span className="subscription-price">
              {plan.oldPrice && <small>{plan.oldPrice}</small>}
              <span className="subscription-price-value">
                <strong>{plan.priceLabel}</strong>
                {planPricePeriods[plan.id] && <span className="subscription-price-period">/{planPricePeriods[plan.id]}</span>}
              </span>
            </span>
            <span className="subscription-radio-mark" aria-hidden="true" />
          </label>
        ))}
      </section>

      <div className="paywall-buy-bar">
        <button className="primary-button paywall-buy-button" onClick={() => onBuy(selectedPlan.id)} type="button">
          Подписаться сейчас
        </button>
      </div>
    </main>
  );
}
