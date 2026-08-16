import { useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { type SubscriptionPlan, type SubscriptionPlanId } from "@novell-reader/shared";

export function PaywallScreen({
  onBack,
  onBuy,
  plans
}: {
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
        <h1>Подписка</h1>
      </header>

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
              <strong>{plan.priceLabel}</strong>
            </span>
            <span className="subscription-radio-mark" aria-hidden="true" />
          </label>
        ))}
      </section>

      <div className="paywall-benefits" aria-label="Что входит">
        <span>
          <Check size={17} /> Все главы
        </span>
        <span>
          <Crown size={17} /> Без ожидания
        </span>
      </div>

      <div className="paywall-buy-bar">
        <button className="primary-button paywall-buy-button" onClick={() => onBuy(selectedPlan.id)} type="button">
          Купить подписку · {selectedPlan.priceLabel}
        </button>
      </div>
    </main>
  );
}
