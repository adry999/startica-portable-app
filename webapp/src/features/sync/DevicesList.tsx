import { useState } from 'react';
import { Button, ConfirmDeleteDialog } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import type { SyncDevice } from './useSyncSettings';
import styles from './DevicesList.module.css';

export interface DevicesListProps {
  devices: SyncDevice[];
  onRevoke: (deviceId: string) => Promise<void>;
}

function daysOffline(lastSeenAt: string): number {
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

/** Lista „Calculatoare conectate” (14b) — rândul propriu nu are „Deconectează”, celelalte cer confirmare. */
export function DevicesList({ devices, onRevoke }: DevicesListProps) {
  const session = useAppSession();
  const [pendingRevoke, setPendingRevoke] = useState<SyncDevice | null>(null);

  function branchName(branchId: string | null): string | null {
    if (!branchId) return null;
    return session.state.branches.find(branch => branch.id === branchId)?.name ?? null;
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    await onRevoke(pendingRevoke.id);
    setPendingRevoke(null);
  }

  return (
    <div className={styles.list}>
      {devices.map(device => {
        const offlineDays = daysOffline(device.lastSeenAt);
        const branch = branchName(device.lastBranchId);
        return (
          <div key={device.id} className={styles.row}>
            <span className={offlineDays > 0 ? `${styles.dot} ${styles.dotOffline}` : styles.dot} aria-hidden="true" />
            <div className={styles.info}>
              <span className={styles.name}>{device.name}</span>
              <span className={styles.meta}>
                {device.os}
                {branch ? ` · deschide de obicei Filiala ${branch}` : ''}
              </span>
              <span className={styles.status}>{offlineDays > 0 ? `Offline de ${offlineDays} zile` : 'Sincronizat'}</span>
            </div>
            {!device.me && (
              <Button variant="ghost" className={styles.revoke} onClick={() => setPendingRevoke(device)}>
                Deconectează
              </Button>
            )}
          </div>
        );
      })}

      <ConfirmDeleteDialog
        open={!!pendingRevoke}
        title={`Deconectează ${pendingRevoke?.name ?? ''}`}
        description="Calculatorul nu va mai primi și nu va mai trimite date către acest server. Datele lui locale rămân neatinse."
        confirmWord="DECONECTEAZĂ"
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  );
}
