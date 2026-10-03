import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

export interface PrintOptionsDialogProps {
  open: boolean;
  /** Implicit „Opțiuni de printare". */
  title?: string;
  onClose: () => void;
  onPrint: () => void;
  printing?: boolean;
  /** Conținutul formularului de opțiuni (checkbox-uri, select-uri) — dat de apelant,
   * `PrintOptionsDialog` nu știe ce opțiuni există pentru fiecare ecran de print. */
  children: ReactNode;
}

/** Dialog de opțiuni înainte de printare, peste `Dialog` (același tipar ca `ConfirmDialog`) —
 * COMPONENTE.md §0i. */
export function PrintOptionsDialog({
  open,
  title = 'Opțiuni de printare',
  onClose,
  onPrint,
  printing = false,
  children,
}: PrintOptionsDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      shouldBlockClose={() => printing}
      primary={{
        label: 'Printează',
        type: 'button',
        loading: printing,
        loadingLabel: 'Se printează…',
        onClick: onPrint,
      }}
    >
      {children}
    </Dialog>
  );
}
