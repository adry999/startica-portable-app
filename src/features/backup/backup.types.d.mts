import type { DatabaseSync } from 'node:sqlite';
import type { RecordsSnapshot } from '#shared/contracts/record-types.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RunRevisionTransaction } from '#shared/contracts/persistence.mjs';

export interface BackupFileEntry {
  name: string;
  modified: string;
  bytes: number;
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
  /** Toate folderele de date/backup ale tuturor filialelor (registrul), niciodată doar cel curent — vezi decizia 12 din planul Filiale. */
  forbiddenFolders: () => string[];
}

export interface BackupService {
  backup(reason?: string): BackupResult;
  safeBackup(reason?: string): SafeBackupResult;
  autoBackup(): SafeBackupResult;
  health(): BackupHealth;
  listBackups(): BackupFileEntry[];
  resolveBackupFile(name: unknown): string;
  listExternalBackups(dir: string): BackupFileEntry[];
  resolveExternalBackupFile(dir: string, name: unknown): string;
  cancelScheduledBackup(): void;
}

export interface BackupRoutesDependencies {
  backupService: BackupService;
  readSetting: (key: string) => string;
  writeSetting: (key: string, value: string) => void;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
  replaceAllRecords: (snapshot: RecordsSnapshot, action: string) => void;
  backupDirectory: string;
  forbiddenFolders: () => string[];
  /** 42d: arhiva completă (toate bazele) — opțional, lipsește doar într-un context de test izolat de filială. */
  fullBackupService?: ReturnType<typeof import('./server/full-backup.service.mjs').createFullBackupService>;
  /** 42d: restaurare dintr-o arhivă .startica-backup — create-application.mjs. */
  restoreFullBackup?: (file: string) => void;
}

export interface BackupControllerDependencies {
  elements: {
    backupButton: HTMLButtonElement;
    restoreButton: HTMLButtonElement;
    restoreDialog: HTMLDialogElement;
    restoreSource: HTMLFieldSetElement;
    restoreExternal: HTMLElement;
    restoreFolder: HTMLInputElement;
    restoreFolderLoad: HTMLButtonElement;
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
