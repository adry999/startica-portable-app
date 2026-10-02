import type { ChangeSink } from '#shared/contracts/change-sink.d.mts';

export type { ChangeSink };

/** Tipurile sincronizate (records/TYPES) plus prezența, șabloanele SMS, setările sincronizate
 * (Fazele 2-6) și istoricul pe calculatoare (§5.3, 36g — append-only, doar profil Complet). */
export type SyncKind =
  | 'children'
  | 'payments'
  | 'expenses'
  | 'groups'
  | 'categories'
  | 'visits'
  | 'attendance'
  | 'sms_templates'
  | 'settings'
  | 'audit_log';

export type SyncOutboxStatus = 'pending' | 'sent' | 'parked';

export interface SyncOutboxChange {
  seq: number;
  changeId: string;
  kind: SyncKind;
  recordId: string;
  baseRevision: number;
  payload: unknown | null;
  createdAt: string;
  status: SyncOutboxStatus;
}

export interface SyncStateEntry {
  kind: SyncKind;
  id: string;
  serverRevision: number;
  updatedAt: string;
  updatedByDevice: string;
  updatedByName: string;
}

export interface SyncConflictEntry {
  id: string;
  kind: SyncKind;
  recordId: string;
  localPayload: unknown | null;
  localUpdatedAt: string;
  remotePayload: unknown | null;
  remoteRevision: number;
  remoteUpdatedAt: string;
  remoteDeviceId: string;
  remoteDeviceName: string;
  createdAt: string;
  outboxSeq: number | null;
}

/** `<home>\sync.json` — identitatea de dispozitiv, per instalare (decizia 2 din plan). */
export interface SyncDeviceFile {
  version: 1;
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  token: string;
  connectedAt: string;
  /** Ultima sincronizare reușită (oricare motor — filiala sau comunul), pentru 21c/14a. */
  lastSyncedAt?: string;
  /** §5.3 (36g): profilul acestui calculator, reîmprospătat de motorul de sincronizare la
   * fiecare ciclu din `GET /v1/devices/me` — `undefined` până la primul ciclu reușit după
   * conectare (tratat ca Complet, vezi `computer-profile.mjs#completProfile`). */
  profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile;
}

export interface SyncDeviceRepository {
  read(): SyncDeviceFile | null;
  write(device: Omit<SyncDeviceFile, 'version'>): void;
  clear(): void;
}
