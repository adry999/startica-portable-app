import { useEffect, useSyncExternalStore } from 'react';
import { useAppSession, requestJson, reloadRecords } from '@shared/api/session';

export interface SyncStatus {
  configured: boolean;
  serverUrl: string;
  deviceName: string;
  connection: 'online' | 'offline' | 'revoked';
  pending: number;
  pushing: boolean;
  lastSyncedAt: string;
  conflicts: number;
  lastError: string;
}

const EMPTY_STATUS: SyncStatus = {
  configured: false,
  serverUrl: '',
  deviceName: '',
  connection: 'online',
  pending: 0,
  pushing: false,
  lastSyncedAt: '',
  conflicts: 0,
  lastError: '',
};

const RELOAD_DEBOUNCE_MS = 1000;
const POLL_FALLBACK_MS = 10000;

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

/**
 * Setul comun (Personal 24, decizia 9, 2026-09-27-personal-bazin.md): evenimentul local
 * `records-changed` poartă acum `dataset` — `usePersonal()`/`usePool()` se abonează aici
 * ca să reîncarce doar pe cel care le privește (`reloadRecords()` de mai jos rămâne pentru
 * `dataset: 'branch'`, singurul care afectează starea sesiunii/`session.state.revision`).
 */
type Dataset = 'branch' | 'comun';
type DatasetListener = (dataset: Dataset) => void;
const datasetListeners = new Set<DatasetListener>();

export function onRecordsChangedByDataset(listener: DatasetListener): () => void {
  datasetListeners.add(listener);
  return () => {
    datasetListeners.delete(listener);
  };
}

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion() {
  return version;
}

// Stare de modul, nu per componentă (la fel ca session.ts): un singur EventSource către
// server, indiferent de câte componente citesc useSyncStatus() în același timp.
let status: SyncStatus = EMPTY_STATUS;
let started = false;
let eventSource: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
// Actualizată de fiecare componentă montată (useEffect, la fiecare randare) — evită o
// dependență circulară pe starea sesiunii doar pentru a compara o revizie.
let latestKnownRevision = 0;

function setStatus(next: SyncStatus) {
  status = next;
  notify();
}

async function pollStatus() {
  try {
    setStatus((await requestJson('/api/sync/status')) as SyncStatus);
  } catch {
    // Rută locală (nu cere rețea către server) — o eroare aici e neobișnuită; motorul
    // își arată singur `connection: 'offline'` în statusul primit, nu aici.
  }
}

function stopPollingFallback() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPollingFallback() {
  if (pollTimer) return;
  pollTimer = setInterval(() => void pollStatus(), POLL_FALLBACK_MS);
}

function scheduleReload() {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    reloadRecords();
  }, RELOAD_DEBOUNCE_MS);
}

function start() {
  if (started) return;
  started = true;
  void pollStatus();
  eventSource = new EventSource('/api/sync/events');
  eventSource.addEventListener('status', event => {
    setStatus(JSON.parse((event as MessageEvent).data) as SyncStatus);
    // Statusul a ajuns prin SSE — polling-ul de rezervă nu mai e necesar cât fluxul e viu.
    stopPollingFallback();
  });
  eventSource.addEventListener('records-changed', event => {
    const data = JSON.parse((event as MessageEvent).data) as { revision: number; dataset?: Dataset };
    const dataset = data.dataset ?? 'branch';
    // Setul comun nu ține revizia sesiunii de filială (Personal nu e în /api/state, decizia 2
    // din plan) — reîncărcarea lui trece doar prin ascultătorii de mai jos, nu prin
    // scheduleReload()/reloadRecords() (acela cere /api/state, irelevant pentru „comun”).
    if (dataset === 'branch' && data.revision !== latestKnownRevision) scheduleReload();
    for (const listener of datasetListeners) listener(dataset);
  });
  eventSource.onerror = () => startPollingFallback();
}

/**
 * Doar pentru teste — un modul singleton nu se resetează singur între cazuri.
 * @internal
 */
export function __resetSyncStatusForTests() {
  listeners.clear();
  version = 0;
  status = EMPTY_STATUS;
  started = false;
  eventSource?.close();
  eventSource = null;
  stopPollingFallback();
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  latestKnownRevision = 0;
  datasetListeners.clear();
}

/**
 * Cardul 14a citește starea de aici. Pornește fluxul SSE doar când sincronizarea e
 * configurată (`session.state.sync?.configured`) — o instalare neconectată nu deschide
 * nicio conexiune și rămâne cu comportamentul de astăzi.
 */
export function useSyncStatus(): SyncStatus {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const session = useAppSession();
  const configured = !!session.state.sync?.configured;

  useEffect(() => {
    latestKnownRevision = session.state.revision;
  });

  useEffect(() => {
    if (configured) start();
  }, [configured]);

  return configured ? status : EMPTY_STATUS;
}

/**
 * Personal 24 (decizia 9): `usePersonal()` ascultă `'comun'`, `usePool()`-urile din
 * `shared/pool/usePool.ts` ascultă `'branch'` (Bazinul e per filială) — o modificare
 * făcută de pe alt calculator reîncarcă ecranul deschis aici, fără reload manual.
 * Nu pornește singur fluxul SSE — el pornește doar din `useSyncStatus()` (cardul 14a),
 * montat oricum global cât sincronizarea e configurată.
 */
export function useReloadOnRecordsChanged(dataset: 'branch' | 'comun', reload: () => void): void {
  useEffect(
    () =>
      onRecordsChangedByDataset(changed => {
        if (changed === dataset) reload();
      }),
    [dataset, reload],
  );
}
