import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `'danger'` = confirmarea e o acțiune distructivă (buton plin roz), altfel confirmarea obișnuită (portocaliu). */
  tone?: 'default' | 'danger';
  /** Butonul de confirmare arată starea de încărcare și ignoră clicurile suplimentare. */
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmare da/nu peste `Dialog` (28g) — pentru acțiuni fără text de tastat (spre deosebire de
 * `ConfirmDeleteDialog`, care cere „Scrie ȘTERGE" pentru ștergerea definitivă).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  tone = 'default',
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      shouldBlockClose={() => confirming}
      onCancel={onCancel}
      cancelLabel={cancelLabel}
      primary={{
        label: confirmLabel,
        type: 'button',
        loading: confirming,
        loadingLabel: 'Se procesează…',
        variant: tone === 'danger' ? 'danger-solid' : 'primary',
        onClick: onConfirm,
      }}
    >
      {description}
    </Dialog>
  );
}
