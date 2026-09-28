import { useState } from 'react';
import { Button, Card, LoadingState, useToast } from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { ConnectServerForm } from './ConnectServerForm';
import { PairingCodeCard } from './PairingCodeCard';
import { DevicesList } from './DevicesList';
import { useSyncSettings, type PairingCode } from './useSyncSettings';
import { useSyncStatus } from './useSyncStatus';
import backupStyles from '../backup/BackupPage.module.css';
import styles from './SyncSettings.module.css';

/** Fila „Sincronizare” (14b) din Backup și setări — vezi 18-sincronizare.md, Sincronizare.dc.html#14b. */
export function SyncSettings() {
  const sync = useSyncSettings();
  const status = useSyncStatus();
  const toast = useToast();
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [creatingPairing, setCreatingPairing] = useState(false);

  async function handleConnected(result: { uploaded: string[]; downloaded: string[] }) {
    toast.show({
      message: `Conectat. Filiale urcate: ${result.uploaded.length}, descărcate: ${result.downloaded.length}.`,
    });
    window.location.reload();
  }

  async function handleDisconnect() {
    try {
      await sync.disconnect();
      window.location.reload();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function handleSyncNow() {
    try {
      await sync.syncNow();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function handleCreatePairing() {
    setCreatingPairing(true);
    try {
      setPairing(await sync.createPairingCode());
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setCreatingPairing(false);
    }
  }

  if (!sync.configured) {
    return (
      <Card className={backupStyles.panel}>
        <h3 className={backupStyles.panelTitle}>Conectează acest calculator la server</h3>
        <ConnectServerForm
          suggestedName={sync.suggestedName}
          connecting={sync.connecting}
          onConnect={sync.connect}
          onConnected={result => void handleConnected(result)}
          onError={message => toast.show({ message })}
        />
      </Card>
    );
  }

  const offline = status.connection === 'offline' || status.connection === 'revoked';

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Card
          className={
            offline ? `${backupStyles.panel} ${styles.serverCardOffline}` : `${backupStyles.panel} ${styles.serverCard}`
          }
        >
          <h3 className={backupStyles.panelTitle}>Server</h3>
          <p className={styles.status}>
            {status.connection === 'revoked'
              ? 'Deconectat de pe server'
              : status.connection === 'offline'
                ? `Fără internet${status.lastSyncedAt ? ` · ultima sincronizare ${formatDateTime(status.lastSyncedAt)}` : ''}`
                : `Conectat · sincronizat la ${status.lastSyncedAt ? formatDateTime(status.lastSyncedAt) : '—'}`}
          </p>
          {sync.server && (
            <p className={styles.counters}>
              Ambele filiale · {sync.server.branches} filiale · {sync.server.devices} calculatoare · ultima copie de
              siguranță pe server: {sync.server.lastBackupAt ? formatDateTime(sync.server.lastBackupAt) : '—'}
            </p>
          )}
          <div className={backupStyles.toolbar}>
            <Button disabled={sync.syncing} onClick={() => void handleSyncNow()}>
              Sincronizează acum
            </Button>
            <Button variant="ghost" onClick={() => void handleDisconnect()}>
              Deconectează acest calculator
            </Button>
          </div>
        </Card>

        <Card className={backupStyles.panel}>
          <div className={styles.header}>
            <h3 className={backupStyles.panelTitle}>Calculatoare conectate</h3>
            <Button variant="outline" disabled={creatingPairing} onClick={() => void handleCreatePairing()}>
              + Conectează un calculator
            </Button>
          </div>
          {!sync.devicesReady ? <LoadingState /> : <DevicesList devices={sync.devices} onRevoke={sync.revokeDevice} />}
        </Card>

        <Card className={backupStyles.panel}>
          <h3 className={backupStyles.panelTitle}>Cum funcționează</h3>
          <p className={backupStyles.notice}>
            Fiecare calculator ține datele local și lucrează fără internet. Modificările se trimit automat la fiecare
            câteva secunde către server, care le distribuie mai departe celorlalte calculatoare conectate.
          </p>
        </Card>

        <Card className={backupStyles.panel}>
          <h3 className={backupStyles.panelTitle}>Calculator pierdut sau vândut?</h3>
          <p className={backupStyles.notice}>
            Deconectează-l din lista de mai sus. Nu va mai putea trimite sau primi date, iar datele care au ajuns deja
            pe celelalte calculatoare rămân neatinse.
          </p>
        </Card>
      </div>

      {pairing && <PairingCodeCard pairing={pairing} onClose={() => setPairing(null)} />}
    </div>
  );
}
