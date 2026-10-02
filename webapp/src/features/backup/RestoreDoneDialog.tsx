import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@shared/ui';
import styles from './RestoreDoneDialog.module.css';

const COUNTDOWN_SECONDS = 5;

export interface RestoreDoneDialogProps {
  open: boolean;
  /** Numărul de filiale restaurate (Comun e mereu inclus, nu intră în numărătoare — mesajul îl
   * numește separat, ca în 46d). */
  branchCount: number;
  onReload: () => void;
}

/** 46d — după restaurarea unei arhive complete, clientul rămâne cu filiale/date vechi în
 * memorie (pot apărea/dispărea filiale întregi) până la o reîncărcare completă a paginii.
 * Fără × și fără Esc — reîncărcarea nu e opțională, doar momentul ei (acum sau în 5 s). */
export function RestoreDoneDialog({ open, branchCount, onReload }: RestoreDoneDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(COUNTDOWN_SECONDS);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (secondsLeft <= 0) {
      onReloadRef.current();
      return;
    }
    const id = setTimeout(() => setSecondsLeft(seconds => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [open, secondsLeft]);

  return (
    <Dialog
      open={open}
      title="Restaurare gata"
      width={560}
      hideClose
      shouldBlockClose={() => true}
      onClose={() => {}}
      footer={<Button onClick={onReload}>Reîncarcă acum</Button>}
    >
      <div className={styles.body}>
        <p className={styles.text}>
          Am restaurat {branchCount} {branchCount === 1 ? 'filială' : 'filiale'} și baza Comun. Am făcut întâi un backup
          de siguranță al datelor de dinainte.
        </p>
        <p className={styles.countdown}>Aplicația se reîncarcă în {secondsLeft} s ca să citească filialele noi.</p>
      </div>
    </Dialog>
  );
}
