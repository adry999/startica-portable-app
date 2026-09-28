import { useCallback, useEffect, useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';

export interface SyncDevice {
  id: string;
  name: string;
  os: string;
  lastSeenAt: string;
  lastBranchId: string | null;
  revokedAt: string | null;
  me: boolean;
}

export interface SyncServerInfo {
  branches: number;
  devices: number;
  lastBackupAt: string;
  connection?: 'online' | 'offline' | 'revoked';
}

export interface PairingCode {
  code: string;
  expiresAt: string;
  serverUrl: string;
}

export interface ConnectInput {
  serverUrl: string;
  code?: string;
  setupKey?: string;
  deviceName: string;
}

export interface ConnectResult {
  uploaded: string[];
  downloaded: string[];
}

export interface SyncSettingsData {
  configured: boolean;
  deviceName: string;
  serverUrl: string;
  connection?: 'online' | 'offline' | 'revoked';
  suggestedName: string;
  server: SyncServerInfo | null;
  devices: SyncDevice[];
  devicesReady: boolean;
  connecting: boolean;
  connect: (input: ConnectInput) => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncing: boolean;
  createPairingCode: () => Promise<PairingCode>;
  revokeDevice: (deviceId: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Fila Sincronizare (14b, Task 12). Citește `session.state.sync` pentru starea de bază
 * (configurat/nume/adresă), apoi — doar când e configurat — cardul serverului și lista de
 * calculatoare, din rutele Task 11 (`/api/sync/server`, `/api/sync/devices`).
 */
export function useSyncSettings(): SyncSettingsData {
  const session = useAppSession();
  const sync = session.state.sync;
  const configured = !!sync?.configured;
  const [server, setServer] = useState<SyncServerInfo | null>(null);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [devicesReady, setDevicesReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!configured) {
      setServer(null);
      setDevices([]);
      setDevicesReady(false);
      return;
    }
    setDevicesReady(false);
    const [serverInfo, deviceList] = await Promise.all([
      requestJson('/api/sync/server') as Promise<SyncServerInfo>,
      requestJson('/api/sync/devices') as Promise<{ devices: SyncDevice[] }>,
    ]);
    setServer(serverInfo);
    setDevices(deviceList.devices);
    setDevicesReady(true);
  }, [configured]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(input: ConnectInput): Promise<ConnectResult> {
    setConnecting(true);
    try {
      return (await requestJson('/api/sync/connect', input)) as ConnectResult;
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await requestJson('/api/sync/disconnect', {});
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await requestJson('/api/sync/now', {});
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function createPairingCode(): Promise<PairingCode> {
    return (await requestJson('/api/sync/pairing-codes', {})) as PairingCode;
  }

  async function revokeDevice(deviceId: string) {
    await requestJson('/api/sync/devices/revoke', { deviceId });
    await load();
  }

  return {
    configured,
    deviceName: sync && sync.configured ? sync.deviceName : '',
    serverUrl: sync && sync.configured ? sync.serverUrl : '',
    connection: sync && sync.configured ? sync.connection : undefined,
    suggestedName: sync && !sync.configured ? sync.suggestedName : '',
    server,
    devices,
    devicesReady,
    connecting,
    connect,
    disconnect,
    syncNow,
    syncing,
    createPairingCode,
    revokeDevice,
    reload: load,
  };
}
