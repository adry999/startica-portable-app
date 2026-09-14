import type { DatabaseSync } from 'node:sqlite';
import type { RecordsSnapshot } from '#shared/contracts/record-types.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RunRevisionTransaction } from '#shared/contracts/persistence.mjs';

export interface BackupFileEntry {
  name: string;
  modified: string;
}

export interface BackupFolderSummary {
  count: number;
  bytes: number;
}

/** Contractul HTTP existent al /api/health; se păstrează neschimbat la migrare. */
export interface BackupHealth {
  ok: true;
  database: string;
  backup: string;
  externalDir: string;
  lastLocal: string;
  lastExternal: string;
  localError: string;
  externalError: string;
  cloudVerified: false;
  permanentBackups: BackupFolderSummary;
  externalBackups: BackupFolderSummary;
}

export interface BackupResult {
  file: string;
  name: string;
  warning: string;
}

export interface SafeBackupResult {
  file?: string;
  name?: string;
  warning: string;
  skipped?: true;
}

export interface BackupServiceDependencies {
  database: DatabaseSync;
  databaseFile: string;
  backupDirectory: string;
  readSetting: (key: string) => string;
  writeSetting: (key: string, value: string) => void;
  autoBackupIntervalMs: number;
}

export interface BackupService {
  backup(reason?: string): BackupResult;
  safeBackup(reason?: string): SafeBackupResult;
  autoBackup(): SafeBackupResult;
  health(): BackupHealth;
  listBackups(): BackupFileEntry[];
  resolveBackupFile(name: unknown): string;
  cancelScheduledBackup(): void;
}

export interface BackupRoutesDependencies {
  backupService: BackupService;
  readSetting: (key: string) => string;
  writeSetting: (key: string, value: string) => void;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
  replaceAllRecords: (snapshot: RecordsSnapshot, action: string) => void;
  dataDirectory: string;
  backupDirectory: string;
}

export interface BackupControllerDependencies {
  elements: {
    backupButton: HTMLButtonElement;
    restoreButton: HTMLButtonElement;
    restoreDialog: HTMLDialogElement;
    backupSelect: HTMLSelectElement;
    restoreConfirm: HTMLInputElement;
    restorePreview: HTMLElement;
    commitRestore: HTMLButtonElement;
    settingsForm: HTMLFormElement;
    externalDirInput: HTMLInputElement;
    diagnosticButton: HTMLButtonElement;
  };
  /** Obiectul de sesiune, mutabil și comun întregii interfețe; controller-ul îl citește și scrie prin referință. */
  sessionState: {
    revision: number;
    health: BackupHealth;
    pending: unknown;
    busy: boolean;
    settingsBusy: boolean;
    settingsError: string;
    settingsDirty: boolean;
  };
  requestJson: (path: string, body?: unknown) => Promise<any>;
  submitMutation: (path: string, body: Record<string, unknown>, base?: number) => Promise<unknown>;
  acceptResult: (result: any) => void;
  showNotice: (text: string, isError?: boolean) => void;
  renderSaveStatus: () => void;
}
