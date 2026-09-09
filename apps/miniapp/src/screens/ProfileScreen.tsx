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
          <p className="muted">Подписки нет. Оформите доступ, чтобы читать платные главы без ограничений.</p>
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
