import type { ChangeSink } from '#shared/contracts/change-sink.d.mts';

export type { ChangeSink };

/** Tipurile sincronizate (records/TYPES) plus prezența, șabloanele SMS și setările sincronizate (Fazele 2-6). */
export type SyncKind =
  | 'children'
  | 'payments'
  | 'expenses'
  | 'groups'
  | 'categories'
  | 'visits'
  | 'attendance'
  | 'sms_templates'
  | 'settings';

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
}

export interface SyncDeviceRepository {
  read(): SyncDeviceFile | null;
  write(device: Omit<SyncDeviceFile, 'version'>): void;
  clear(): void;
}
