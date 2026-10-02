import { Button, Card } from '@shared/ui';
import { PRESET_LABELS } from '#shared/domain/computer-profile.mjs';
import type { PairingCode } from './useSyncSettings';
import styles from './PairingCodeCard.module.css';

const presetLabels: Record<string, string> = PRESET_LABELS;

export interface PairingCodeCardProps {
  pairing: PairingCode;
  /** §5.3 (36a, pasul 2): profilul ales la pasul 1 — linia „Profil: …” sub cod. Opțional —
   * un cod generat înainte de profiluri (sau un apelant fără acest context) n-o arată. */
  profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile | null;
  onClose: () => void;
}

/** „+ Conectează un calculator” (14b) — cardul din dreapta cu adresa și codul din 6 cifre. */
export function PairingCodeCard({ pairing, profile, onClose }: PairingCodeCardProps) {
  return (
    <Card className={styles.card}>
      <p className={styles.address}>{pairing.serverUrl}</p>
      <p className={styles.code}>{pairing.code}</p>
      {profile && <p className={styles.hint}>Profil: {presetLabels[profile.preset] ?? profile.preset}</p>}
      <p className={styles.hint}>Codul expiră în 10 minute și poate fi folosit o singură dată.</p>
      <Button variant="ghost" onClick={onClose}>
        Închide
      </Button>
    </Card>
  );
}
