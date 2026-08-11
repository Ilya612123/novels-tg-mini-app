import { LockKeyhole } from "lucide-react";

export function PaywallScreen({ onBack, onBuy }: { onBack: () => void; onBuy: () => void }) {
  return (
    <main className="screen paywall-screen">
      <button className="text-button" onClick={onBack} type="button">
        Назад
      </button>
      <LockKeyhole size={42} />
      <h1>Продолжение по доступу</h1>
      <p>Бесплатная часть закончилась. Откройте доступ на 30 дней, чтобы продолжить чтение.</p>
      <button className="primary-button" onClick={onBuy} type="button">
        Получить доступ
      </button>
    </main>
  );
}
