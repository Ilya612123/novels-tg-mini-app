import { useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { publicSubscriptionPlans, type SubscriptionPlan, type SubscriptionPlanId } from "@novell-reader/shared";

export function PaywallScreen({ onBack, onBuy }: { onBack: () => void; onBuy: (planId: SubscriptionPlanId) => void }) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(publicSubscriptionPlans[0]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <main className="screen paywall-screen">
      <header className="paywall-header">
        <button className="text-button" onClick={onBack} type="button">
          Назад
        </button>
        <h1>Подписка</h1>
      </header>

      <section className="subscription-plans" role="radiogroup" aria-label="Тарифы подписки">
        {publicSubscriptionPlans.map((plan) => (
          <label className={`subscription-plan${selectedPlan.title === plan.title ? " subscription-plan-selected" : ""}`} key={plan.title}>
            <input
              checked={selectedPlan.title === plan.title}
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
