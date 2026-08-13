import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/** Signature element: a string of seaside bunting. */
export function Bunting({ width = 300 }: { width?: number | 'full' }) {
  const flags = width === 'full' ? 120 : Math.max(6, Math.floor(width / 18));
  return (
    <div className="bunting" style={{ width: width === 'full' ? '100%' : width }} aria-hidden>
      {Array.from({ length: flags }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function money(n: number): string {
  return `£${n.toLocaleString('en-GB')}`;
}

/** Celebration: paper squares tumbling down over the victory screen. */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 48 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 41) % 100}%`,
            animationDelay: `${((i * 23) % 40) / 20}s`,
            animationDuration: `${2.4 + ((i * 13) % 20) / 10}s`,
          }}
        />
      ))}
    </div>
  );
}

interface ModalProps {
  title?: string;
  /** Accessible name when there is no visible title. */
  label?: string;
  wide?: boolean;
  onClose?: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal shell: focus moves in on open (respecting any autoFocus inside),
 * Tab is trapped within the dialog, Escape closes (when closable),
 * click on the backdrop closes.
 */
export function Modal({ title, label, wide, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Don't steal focus from an autoFocus element already inside the dialog.
    if (ref.current && !ref.current.contains(document.activeElement)) {
      ref.current.focus();
    }
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? label}
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
          if (e.key === 'Tab' && ref.current) {
            const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/**
 * The consistent irreversible-action pattern: anything that moves money or
 * property must pass through one of these before it happens.
 */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div>{body}</div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className={danger ? 'btn-coral' : 'btn-primary'} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
