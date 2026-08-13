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

interface ModalProps {
  title?: string;
  wide?: boolean;
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
}

/**
 * Modal shell: focus moves in on open, Escape closes (when closable),
 * click on the backdrop closes.
 */
export function Modal({ title, wide, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
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
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
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
