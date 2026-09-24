import { useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import type { ChildrenCsvPreviewReport } from '#features/children/children.types.d.mts';

const IMPORT_CONFIRMATION = 'IMPORT COPII';
const MAX_BYTES = 2_000_000;

export interface ChildrenCsvImportData {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  loading: boolean;
  error: string;
  report: ChildrenCsvPreviewReport | null;
  confirmText: string;
  setConfirmText: (value: string) => void;
  canCommit: boolean;
  committing: boolean;
  pickFile: (file: File) => Promise<void>;
  commit: () => Promise<{ imported: number }>;
}

/** Echivalentul children-csv-dialog.mjs: previzualizare server-side, apoi commit cu fraza „IMPORT COPII”. */
export function useChildrenCsvImport(): ChildrenCsvImportData {
  const session = useAppSession();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ChildrenCsvPreviewReport | null>(null);
  const [csvText, setCsvText] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);

  function openDialog() {
    setOpen(true);
    setError('');
    setReport(null);
    setCsvText('');
    setConfirmText('');
  }

  function closeDialog() {
    setOpen(false);
  }

  async function pickFile(file: File) {
    setError('');
    setReport(null);
    setConfirmText('');
    if (file.size > MAX_BYTES) {
      setError('Fișier prea mare (maximum 2 MB).');
      return;
    }
    setLoading(true);
    try {
      const csv = await file.text();
      const response = (await requestJson('/api/children-csv-preview', { csv })) as ChildrenCsvPreviewReport;
      setCsvText(csv);
      setReport(response);
      if (response.errors.length) setError(response.errors.join('\n'));
    } catch (fileError) {
      setError((fileError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function commit(): Promise<{ imported: number }> {
    if (!report || report.errors.length || !report.additions.length)
      throw new Error('Nu există copii noi de importat.');
    setCommitting(true);
    try {
      await session.mutate('/api/children-csv', { csv: csvText, confirm: confirmText });
      const imported = report.additions.length;
      setOpen(false);
      return { imported };
    } finally {
      setCommitting(false);
    }
  }

  return {
    open,
    openDialog,
    closeDialog,
    loading,
    error,
    report,
    confirmText,
    setConfirmText,
    canCommit: Boolean(
      report && !report.errors.length && report.additions.length && confirmText === IMPORT_CONFIRMATION,
    ),
    committing,
    pickFile,
    commit,
  };
}
