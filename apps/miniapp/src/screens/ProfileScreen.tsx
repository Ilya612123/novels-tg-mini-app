import type { AccessStatusDto } from "@novell-reader/shared";

export function ProfileScreen({
  accessStatus,
  paymentStatusMessage,
  onOpenPaywall,
  onOpenSupport
}: {
  accessStatus: AccessStatusDto | null;
  paymentStatusMessage?: string | null;
  onOpenPaywall: () => void;
  onOpenSupport: () => void;
}) {
  const subscriptionDate = accessStatus?.subscriptionUntil
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(accessStatus.subscriptionUntil))
    : null;

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Профиль</h1>
      </header>
      <section className="profile-section">
        <h2>Доступ</h2>
        {paymentStatusMessage && <p className="profile-payment-status">{paymentStatusMessage}</p>}
        {accessStatus?.active && subscriptionDate ? (
          <p className="profile-access-status">Подписка активна до {subscriptionDate}</p>
        ) : (
          <div className="profile-subscription-benefits">
            <p>Подписка открывает продолжение без ограничений.</p>
            <ul>
              <li>Все платные главы во всех новеллах</li>
              <li>Доступ на 30 дней сразу после оплаты</li>
              <li>Чтение без ожидания новых бесплатных глав</li>
            </ul>
          </div>
        )}
        {!accessStatus?.active && (
          <button className="primary-button profile-subscription-button" onClick={onOpenPaywall} type="button">
            Купить подписку
          </button>
        )}
        <button className="text-button profile-support-button" onClick={onOpenSupport} type="button">
          Поддержка
        </button>
      </section>
    </main>
  );
}
