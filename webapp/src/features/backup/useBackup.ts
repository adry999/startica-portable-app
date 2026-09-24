import { useEffect, useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { formatFileSize } from '#shared/format/file-size-format.mjs';
import { today } from '@domain/calendar-month.mjs';

// O zi în ms: peste atât, un backup local sau extern e considerat vechi.
const STALE_AFTER_MS = 86400000;

export interface BackupHealthView {
  ok: boolean;
  database: string;
  externalDir: string;
  lastLocal: string;
  lastExternal: string;
  localError: string;
  externalError: string;
  permanentBackups: { count: number; bytes: number };
  externalBackups: { count: number; bytes: number };
}

export type HealthTone = 'ok' | 'warning' | 'error';

export interface BackupData {
  ready: boolean;
  health: BackupHealthView | null;
  statusLabel: string;
  statusTone: HealthTone;
  detailLines: string[];
  externalDirInput: string;
  setExternalDirInput: (value: string) => void;
  settingsBusy: boolean;
  settingsError: string;
  saveSettings: () => Promise<void>;
  backupBusy: boolean;
  backupNow: () => Promise<void>;
  diagnosticBusy: boolean;
  downloadDiagnostic: () => Promise<void>;
}

function isStale(timestamp: string): boolean {
  return !timestamp || Date.now() - new Date(timestamp).getTime() > STALE_AFTER_MS;
}

function statusOf(health: BackupHealthView): { label: string; tone: HealthTone } {
  const stale = isStale(health.lastLocal);
  const externalStale = isStale(health.lastExternal);
  const hasError = Boolean(health.localError || health.externalError);
  const hasWarning = !hasError && (stale || !health.externalDir || externalStale);
  const label = health.localError
    ? 'Backup local eșuat'
    : stale
      ? 'Backup local vechi/lipsă'
      : !health.externalDir
        ? 'Backup local OK · copie externă neconfigurată'
        : health.externalError || externalStale
          ? 'Copia externă necesită atenție'
          : 'Backup local și copie externă verificate';
  return { label, tone: hasError ? 'error' : hasWarning ? 'warning' : 'ok' };
}

function detailLinesOf(health: BackupHealthView): string[] {
  const lines = [
    `Bază: ${health.database}`,
    `Backup local: ${formatDateTime(health.lastLocal)}`,
    `Copie externă: ${formatDateTime(health.lastExternal)}`,
  ];
  const errorLine =
    health.localError || health.externalError || (!health.externalDir ? 'Copia externă nu este configurată.' : '');
  if (errorLine) lines.push(errorLine);
  lines.push('Sincronizarea în cloud nu este confirmată de aplicație. Verifică starea din Google Drive.');
  lines.push(
    `Păstrare locală: ultimele 20 de copii, câte una pentru ultimele 30 de zile cu backup și 12 luni cu backup. ` +
      `Copiile dinaintea importului, restaurării și migrării nu expiră automat: ${health.permanentBackups.count} copii, ${formatFileSize(health.permanentBackups.bytes)}. Șterge-le manual din Startica_Backup dacă nu mai sunt necesare.`,
  );
  if (health.externalDir)
    lines.push(
      `Folderul extern urmează aceeași păstrare: ${health.externalBackups.count} copii, ${formatFileSize(health.externalBackups.bytes)}.`,
    );
  return lines;
}

/** Echivalentul panoului „Copii de siguranță” din backup.controller.mjs + backup-health.view.mjs. */
export function useBackup(): BackupData {
  const session = useAppSession();
  const { health, ready } = session.state;

  const [externalDirInput, setExternalDirInputRaw] = useState('');
  const [dirDirty, setDirDirty] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);

  const typedHealth = health as BackupHealthView;
  const hasHealth = ready && typedHealth?.database !== undefined;

  // Câmpul nu se suprascrie cât timp operatorul scrie în el (isExternalDirLocked din legacy).
  useEffect(() => {
    if (hasHealth && !dirDirty) setExternalDirInputRaw(typedHealth.externalDir || '');
  }, [hasHealth, typedHealth?.externalDir, dirDirty]);

  function setExternalDirInput(value: string) {
    setDirDirty(true);
    setExternalDirInputRaw(value);
  }

  async function saveSettings() {
    setSettingsBusy(true);
    setSettingsError('');
    try {
      await session.mutate('/api/settings', { externalDir: externalDirInput });
      setDirDirty(false);
    } catch (error) {
      setSettingsError((error as Error).message);
      throw error;
    } finally {
      setSettingsBusy(false);
    }
  }

  async function backupNow() {
    setBackupBusy(true);
    try {
      await session.mutate('/api/backup', {});
    } finally {
      setBackupBusy(false);
    }
  }

  async function downloadDiagnostic() {
    setDiagnosticBusy(true);
    try {
      const diagnostic = await requestJson('/api/diagnostic');
      const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `startica-diagnostic-${today()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDiagnosticBusy(false);
    }
  }

  if (!ready || !typedHealth || typedHealth.database === undefined) {
    return {
      ready: false,
      health: null,
      statusLabel: '',
      statusTone: 'ok',
      detailLines: [],
      externalDirInput,
      setExternalDirInput,
      settingsBusy,
      settingsError,
      saveSettings,
      backupBusy,
      backupNow,
      diagnosticBusy,
      downloadDiagnostic,
    };
  }

  const { label, tone } = statusOf(typedHealth);

  return {
    ready: true,
    health: typedHealth,
    statusLabel: label,
    statusTone: tone,
    detailLines: detailLinesOf(typedHealth),
    externalDirInput,
    setExternalDirInput,
    settingsBusy,
    settingsError,
    saveSettings,
    backupBusy,
    backupNow,
    diagnosticBusy,
    downloadDiagnostic,
  };
}
