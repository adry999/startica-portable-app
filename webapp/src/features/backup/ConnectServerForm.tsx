import { useState, type FormEvent } from 'react';
import { Button, Field, SegmentedControl, TextInput } from '@shared/ui';
import backupStyles from './BackupPage.module.css';
import type { ConnectInput, ConnectResult } from './useSyncSettings';
import { toUserError } from '@shared/api/to-user-error';

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
      onError(toUserError(error));
    }
  }

  const canSubmit = serverUrl.trim() !== '' && (mode === 'code' ? code.trim() !== '' : setupKey.trim() !== '');

  return (
    <form className={backupStyles.form} autoComplete="off" onSubmit={event => void submit(event)}>
      <SegmentedControl
        ariaLabel="Mod de conectare"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'code', label: 'Am deja o grădiniță pe alt calculator' },
          { value: 'setupKey', label: 'Primul calculator' },
        ]}
      />

      <Field label="Adresa serverului" htmlFor="connect-server-url">
        <TextInput
          id="connect-server-url"
          value={serverUrl}
          onChange={setServerUrl}
          placeholder="https://sync.exemplu.md"
        />
      </Field>

      {mode === 'code' ? (
        <Field label="Codul de conectare" htmlFor="connect-code">
          <TextInput id="connect-code" value={code} onChange={setCode} placeholder="123456" maxLength={6} />
        </Field>
      ) : (
        <Field label="Cheia de instalare" htmlFor="connect-setup-key">
          <TextInput id="connect-setup-key" value={setupKey} onChange={setSetupKey} />
        </Field>
      )}

      <Field label="Numele acestui calculator" htmlFor="connect-device-name">
        <TextInput id="connect-device-name" value={deviceName} onChange={setDeviceName} placeholder={suggestedName} />
      </Field>

      <Button type="submit" disabled={connecting || !canSubmit}>
        {connecting ? 'Se conectează…' : 'Conectează'}
      </Button>
    </form>
  );
}
