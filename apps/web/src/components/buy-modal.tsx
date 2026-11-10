"use client";

import type { Datacut } from "@dataonly/core";
import { Icon } from "@/components/icons";

export function BuyModal({
  cut,
  open,
  onClose,
}: {
  cut: Datacut;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="buy-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="buy-title">
      <div className="buy-modal">
        <button type="button" className="buy-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        <span className="kicker">Mock purchase</span>
        <h2 id="buy-title">Ready to buy?</h2>
        <p>
          <strong>{cut.title}</strong> — ${cut.price} USD. This is a prototype confirmation only.
          No payment will be charged.
        </p>
        <p className="buy-license">{cut.licenseBlurb}</p>
        <div className="buy-modal-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onClose();
            }}
          >
            Confirm (fake) <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
