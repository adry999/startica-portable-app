import { useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';

const RESTORE_CONFIRMATION = 'RESTAUREAZA';
// O zi în ms: peste atât, cea mai recentă copie externă atrage atenția.
const STALE_AFTER_MS = 86400000;

export type RestoreSource = 'local' | 'extern';

interface BackupEntry {
  name: string;
  modified: string;
}

export interface BackupOption {
  name: string;
  label: string;
}

export interface RestorePreview {
  summaryLine: string;
  totalsLine: string;
  notes: string[];
  errors: string[];
}

export interface RestoreData {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  source: RestoreSource;
  setSource: (value: RestoreSource) => void;
  externalFolder: string;
  setExternalFolder: (value: string) => void;
  loadExternalBackups: () => Promise<void>;
  loadingBackups: boolean;
  backupsError: string;
  options: BackupOption[];
  selectedName: string;
  setSelectedName: (value: string) => void;
  staleFolderNotice: string;
  preview: RestorePreview | null;
  previewError: string;
  confirmText: string;
  setConfirmText: (value: string) => void;
  canCommit: boolean;
  committing: boolean;
  commit: () => Promise<void>;
}

function previewOf(response: {
  children: number;
  payments: number;
  expenses: number;
  paymentTotal: number;
  expenseTotal: number;
  notes: string[];
  errors: string[];
}): RestorePreview {
  return {
    summaryLine: `${response.children} copii · ${response.payments} achitări · ${response.expenses} cheltuieli`,
    totalsLine: `Total achitări: ${formatMoney(response.paymentTotal)} · Total cheltuieli: ${formatMoney(response.expenseTotal)}`,
    notes: response.notes || [],
    errors: response.errors || [],
  };
}

/** Echivalentul dialogului de restaurare din backup.controller.mjs, aici ca Drawer (nu <dialog>). */
export function useRestore(defaultExternalDir: string): RestoreData {
  const session = useAppSession();

  const [open, setOpen] = useState(false);
  const [source, setSourceRaw] = useState<RestoreSource>('local');
  const [externalFolder, setExternalFolder] = useState('');
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupsError, setBackupsError] = useState('');
  const [options, setOptions] = useState<BackupOption[]>([]);
  const [selectedName, setSelectedNameRaw] = useState('');
  const [staleFolderNotice, setStaleFolderNotice] = useState('');
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);

  function resetSelection() {
    setOptions([]);
    setSelectedNameRaw('');
    setPreview(null);
    setPreviewError('');
    setStaleFolderNotice('');
  }

  async function fetchPreview(name: string, dir: string) {
    if (!name) return;
    try {
      const query = `/api/backup-preview?name=${encodeURIComponent(name)}${dir ? `&dir=${encodeURIComponent(dir)}` : ''}`;
      const response = await requestJson(query);
      setPreview(previewOf(response));
      setPreviewError('');
    } catch (error) {
      setPreview(null);
      setPreviewError((error as Error).message);
    }
  }

  async function loadLocalBackups() {
    resetSelection();
    setLoadingBackups(true);
    setBackupsError('');
    try {
      const backups = (await requestJson('/api/backups')) as BackupEntry[];
      const nextOptions = backups.map(entry => ({
        name: entry.name,
        label: `${formatDateTime(entry.modified)} · ${entry.name}`,
      }));
      setOptions(nextOptions);
      if (nextOptions.length) {
        setSelectedNameRaw(nextOptions[0].name);
        await fetchPreview(nextOptions[0].name, '');
      }
    } catch (error) {
      setBackupsError((error as Error).message);
    } finally {
      setLoadingBackups(false);
    }
  }

  async function loadExternalBackups() {
    resetSelection();
    setLoadingBackups(true);
    setBackupsError('');
    const dir = externalFolder.trim();
    try {
      const { backups } = (await requestJson(`/api/external-backups?dir=${encodeURIComponent(dir)}`)) as {
        backups: BackupEntry[];
      };
      if (!backups.length) {
        setBackupsError('Nu există copii Startica în acest folder.');
        return;
      }
      const nextOptions = backups.map((entry, index) => ({
        name: entry.name,
        label: `${formatDateTime(entry.modified)} · ${entry.name}${index === 0 ? ' · cea mai recentă' : ''}`,
      }));
      setOptions(nextOptions);
      if (Date.now() - new Date(backups[0].modified).getTime() > STALE_AFTER_MS)
        setStaleFolderNotice(
          `Cea mai recentă copie e din ${formatDateTime(backups[0].modified)}; verifică dacă Drive a terminat sincronizarea pe acest calculator.`,
        );
      setSelectedNameRaw(nextOptions[0].name);
      await fetchPreview(nextOptions[0].name, dir);
    } catch (error) {
      setBackupsError((error as Error).message);
    } finally {
      setLoadingBackups(false);
    }
  }

  function setSource(value: RestoreSource) {
    setSourceRaw(value);
    resetSelection();
    if (value === 'local') void loadLocalBackups();
  }

  function setSelectedName(name: string) {
    setSelectedNameRaw(name);
    void fetchPreview(name, source === 'extern' ? externalFolder.trim() : '');
  }

  function openDialog() {
    setConfirmText('');
    setSourceRaw('local');
    setExternalFolder(defaultExternalDir);
    setOpen(true);
    void loadLocalBackups();
  }

  function closeDialog() {
    setOpen(false);
  }

  async function commit() {
    if (!selectedName || !preview || preview.errors.length) return;
    const dir = source === 'extern' ? externalFolder.trim() : '';
    setCommitting(true);
    try {
      await session.mutate('/api/restore', { name: selectedName, dir, confirm: confirmText });
      setOpen(false);
    } finally {
      setCommitting(false);
    }
  }

  return {
    open,
    openDialog,
    closeDialog,
    source,
    setSource,
    externalFolder,
    setExternalFolder,
    loadExternalBackups,
    loadingBackups,
    backupsError,
    options,
    selectedName,
    setSelectedName,
    staleFolderNotice,
    preview,
    previewError,
    confirmText,
    setConfirmText,
    canCommit: Boolean(selectedName && preview && !preview.errors.length && confirmText === RESTORE_CONFIRMATION),
    committing,
    commit,
  };
}
