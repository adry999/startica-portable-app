import { Button, Card } from '@shared/ui';
import type { PairingCode } from './useSyncSettings';
import styles from './PairingCodeCard.module.css';

export interface PairingCodeCardProps {
  pairing: PairingCode;
  onClose: () => void;
}

/** „+ Conectează un calculator” (14b) — cardul din dreapta cu adresa și codul din 6 cifre. */
export function PairingCodeCard({ pairing, onClose }: PairingCodeCardProps) {
  return (
    <Card className={styles.card}>
      <p className={styles.address}>{pairing.serverUrl}</p>
      <p className={styles.code}>{pairing.code}</p>
      <p className={styles.hint}>Codul expiră în 10 minute și poate fi folosit o singură dată.</p>
      <Button variant="ghost" onClick={onClose}>
        Închide
      </Button>
    </Card>
  );
}
