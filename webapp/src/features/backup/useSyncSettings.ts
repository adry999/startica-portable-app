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
  /** §5.3 (36c) — lipsă pe un calculator conectat înainte de profiluri (tratat ca Complet,
   * vezi `completProfile()` server-side). */
  profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile | null;
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
  /** B-5: mesajul de eșec al `/api/sync/devices` (ex. offline, 503) — `null` cât timp lista s-a încărcat. */
  devicesError: string | null;
  connecting: boolean;
  connect: (input: ConnectInput) => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncing: boolean;
  /** §5.3 (36a): profilul ales la pasul 1 — lipsă păstrează comportamentul dinaintea profilurilor. */
  createPairingCode: (
    profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile,
  ) => Promise<PairingCode>;
  revokeDevice: (deviceId: string) => Promise<void>;
  /** §5.3 (36c): „Schimbă” din lista de calculatoare. */
  changeDeviceProfile: (
    deviceId: string,
    profile: import('#shared/domain/computer-profile.mjs').ComputerProfile,
  ) => Promise<void>;
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
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!configured) {
      setServer(null);
      setDevices([]);
      setDevicesReady(false);
      setDevicesError(null);
      return;
    }
    setDevicesReady(false);
    // B-5: `/api/sync/server` traduce singur o rețea căzută într-un răspuns care rezolvă
    // (`{ connection: 'offline' }`), dar `/api/sync/devices` respinge direct (503) — cu
    // `Promise.all`, respingerea lui făcea tot `load()`-ul să respingă: `devicesReady` nu mai
    // ajungea niciodată `true` (spinner la nesfârșit), iar respingerea rămânea netratată.
    // `Promise.allSettled` lasă fiecare secțiune să-și arate propria stare din propriul rezultat.
    const [serverResult, devicesResult] = await Promise.allSettled([
      requestJson('/api/sync/server') as Promise<SyncServerInfo>,
      requestJson('/api/sync/devices') as Promise<{ devices: SyncDevice[] }>,
    ]);
    if (serverResult.status === 'fulfilled') setServer(serverResult.value);
    if (devicesResult.status === 'fulfilled') {
      setDevices(devicesResult.value.devices);
      setDevicesError(null);
    } else {
      setDevices([]);
      setDevicesError((devicesResult.reason as Error)?.message || 'Lista nu este disponibilă offline.');
    }
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

  async function createPairingCode(
    profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile,
  ): Promise<PairingCode> {
    return (await requestJson('/api/sync/pairing-codes', { profile })) as PairingCode;
  }

  async function revokeDevice(deviceId: string) {
    await requestJson('/api/sync/devices/revoke', { deviceId });
    await load();
  }

  async function changeDeviceProfile(
    deviceId: string,
    profile: import('#shared/domain/computer-profile.mjs').ComputerProfile,
  ) {
    await requestJson('/api/sync/devices/profile', { deviceId, profile });
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
    devicesError,
    connecting,
    connect,
    disconnect,
    syncNow,
    syncing,
    createPairingCode,
    revokeDevice,
    changeDeviceProfile,
    reload: load,
  };
}
