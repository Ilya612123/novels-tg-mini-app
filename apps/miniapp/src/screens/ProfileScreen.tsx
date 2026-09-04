export function ProfileScreen({
  onOpenPaywall,
  onOpenSupport
}: {
  onOpenPaywall: () => void;
  onOpenSupport: () => void;
}) {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Профиль</h1>
      </header>
      <section className="profile-section">
        <h2>Доступ</h2>
        <p className="muted">Статус доступа появится после подключения платежей.</p>
        <button className="primary-button profile-subscription-button" onClick={onOpenPaywall} type="button">
          Купить подписку
        </button>
        <button className="text-button profile-support-button" onClick={onOpenSupport} type="button">
          Поддержка
        </button>
      </section>
    </main>
  );
}
