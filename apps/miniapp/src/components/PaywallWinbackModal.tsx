import { X } from "lucide-react";
import type { PaywallWinbackOffer } from "@novell-reader/shared";

export function PaywallWinbackModal({
  offer,
  onAction,
  onClose
}: {
  offer: PaywallWinbackOffer;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="winback-title" aria-modal="true" className="winback-modal" role="dialog">
        <button aria-label="Закрыть предложение" className="winback-close-button" onClick={onClose} type="button">
          <X aria-hidden="true" size={34} />
        </button>
        <h2 id="winback-title">{offer.title}</h2>
        <p>{offer.body}</p>
        <button className="primary-button winback-action-button" onClick={onAction} type="button">
          {offer.buttonLabel}
        </button>
      </section>
    </div>
  );
}
