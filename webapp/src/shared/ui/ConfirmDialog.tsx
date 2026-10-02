import type { ReactNode } from 'react';
import { Button } from './Button';
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
      footer={
        <>
          <Button variant="outline" disabled={confirming} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger-solid' : 'primary'} disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Se procesează…' : confirmLabel}
          </Button>
        </>
      }
    >
      {description}
    </Dialog>
  );
}
