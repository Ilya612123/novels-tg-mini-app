import { useState } from "react";
import { Check, Crown } from "lucide-react";

const plans = [
  { title: "Месяц", price: "299₽", period: "1 месяц", oldPrice: null, discount: null, badge: null },
  { title: "4 месяца", price: "819₽", period: "205₽/мес", oldPrice: "1196₽", discount: "Скидка 31%", badge: "Лучший выбор" },
  { title: "Полгода", price: "1499₽", period: "250₽/мес", oldPrice: "1794₽", discount: "Скидка 16%", badge: null },
  { title: "Год", price: "2999₽", period: "250₽/мес", oldPrice: "3588₽", discount: "Скидка 16%", badge: "Максимум доступа" }
];

export function PaywallScreen({ onBack, onBuy }: { onBack: () => void; onBuy: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState(plans[0]);

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
              <strong>{plan.price}</strong>
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
        <button className="primary-button paywall-buy-button" onClick={onBuy} type="button">
          Купить подписку · {selectedPlan.price}
        </button>
      </div>
    </main>
  );
}
