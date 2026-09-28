import { useState, type FormEvent } from 'react';
import { Button, SegmentedControl } from '@shared/ui';
import backupStyles from '../backup/BackupPage.module.css';
import type { ConnectInput, ConnectResult } from './useSyncSettings';

export interface ConnectServerFormProps {
  suggestedName: string;
  connecting: boolean;
  onConnect: (input: ConnectInput) => Promise<ConnectResult>;
  onConnected: (result: ConnectResult) => void;
  onError: (message: string) => void;
}

type Mode = 'code' | 'setupKey';

/** Neconfigurat (14b) — formularul de conectare, cu cele două moduri din spec (22). */
export function ConnectServerForm({
  suggestedName,
  connecting,
  onConnect,
  onConnected,
  onError,
}: ConnectServerFormProps) {
  const [mode, setMode] = useState<Mode>('code');
  const [serverUrl, setServerUrl] = useState('');
  const [code, setCode] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [deviceName, setDeviceName] = useState(suggestedName);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await onConnect({
        serverUrl: serverUrl.trim(),
        code: mode === 'code' ? code.trim() : undefined,
        setupKey: mode === 'setupKey' ? setupKey.trim() : undefined,
        deviceName: deviceName.trim() || suggestedName,
      });
      onConnected(result);
    } catch (error) {
      onError((error as Error).message);
    }
  }

  const canSubmit = serverUrl.trim() !== '' && (mode === 'code' ? code.trim() !== '' : setupKey.trim() !== '');

  return (
    <form className={backupStyles.form} onSubmit={event => void submit(event)}>
      <SegmentedControl
        ariaLabel="Mod de conectare"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'code', label: 'Am deja o grădiniță pe alt calculator' },
          { value: 'setupKey', label: 'Primul calculator' },
        ]}
      />

      <label className={backupStyles.field}>
        Adresa serverului
        <input
          value={serverUrl}
          onChange={event => setServerUrl(event.target.value)}
          placeholder="https://sync.exemplu.md"
        />
      </label>

      {mode === 'code' ? (
        <label className={backupStyles.field}>
          Codul de conectare
          <input value={code} onChange={event => setCode(event.target.value)} placeholder="123456" maxLength={6} />
        </label>
      ) : (
        <label className={backupStyles.field}>
          Cheia de instalare
          <input value={setupKey} onChange={event => setSetupKey(event.target.value)} />
        </label>
      )}

      <label className={backupStyles.field}>
        Numele acestui calculator
        <input value={deviceName} onChange={event => setDeviceName(event.target.value)} placeholder={suggestedName} />
      </label>

      <Button type="submit" disabled={connecting || !canSubmit}>
        {connecting ? 'Se conectează…' : 'Conectează'}
      </Button>
    </form>
  );
}
