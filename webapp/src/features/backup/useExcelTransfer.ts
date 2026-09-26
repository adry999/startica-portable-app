import { useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import { today } from '@domain/calendar-month.mjs';
import { findRecordIssues } from '#features/review-center/index.web.mjs';
import { readWorkbook, exportWorkbook } from '#features/data-transfer/domain/excel-workbook.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import type { ImportReport } from '#features/data-transfer/data-transfer.types.d.mts';

const IMPORT_CONFIRMATION = 'IMPORT';

export interface ExcelImportData {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  loading: boolean;
  report: ImportReport | null;
  fileName: string;
  confirmText: string;
  setConfirmText: (value: string) => void;
  canCommit: boolean;
  committing: boolean;
  pickFile: (file: File) => Promise<void>;
  commit: () => Promise<void>;
}

export interface ExcelTransferData {
  importDialog: ExcelImportData;
  exporting: boolean;
  exportAll: () => Promise<void>;
}

// Lazy: modulul (~950KB) nu trebuie să încarce la pornirea aplicației.
let xlsxModule: Promise<typeof import('xlsx')> | null = null;
function loadXlsx() {
  if (!xlsxModule) xlsxModule = import('xlsx').catch(error => ((xlsxModule = null), Promise.reject(error)));
  return xlsxModule;
}

/** Parsare client-side, revalidare server, apoi commit cu fraza „IMPORT”. */
export function useExcelTransfer(): ExcelTransferData {
  const session = useAppSession();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [parsedState, setParsedState] = useState<RecordsSnapshot | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  function openDialog() {
    setOpen(true);
    setReport(null);
    setParsedState(null);
    setFileName('');
    setConfirmText('');
  }

  function closeDialog() {
    setOpen(false);
  }

  async function pickFile(file: File) {
    setFileName(file.name);
    setReport(null);
    setParsedState(null);
    setConfirmText('');
    setLoading(true);
    try {
      const XLSX = await loadXlsx();
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const parsed = readWorkbook(workbook, XLSX, findRecordIssues) as ImportReport;
      if (parsed.errors.length) {
        setReport(parsed);
        return;
      }
      const checked = (await requestJson('/api/import-preview', { state: parsed.state })) as ImportReport;
      setReport({
        ...checked,
        warnings: parsed.warnings,
        notes: [...(parsed.notes ?? []), ...(checked.notes ?? [])],
      });
      setParsedState(checked.state ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!report || report.errors.length || !parsedState) throw new Error('Nu există un import valid de confirmat.');
    setCommitting(true);
    try {
      await session.mutate('/api/import', { state: parsedState, confirm: confirmText });
      setOpen(false);
    } finally {
      setCommitting(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const XLSX = await loadXlsx();
      const records = session.state.state as RecordsSnapshot;
      const workbook = exportWorkbook(records, XLSX);
      XLSX.writeFile(workbook, `Startica_complet_${today()}.xlsx`, { compression: true });
    } finally {
      setExporting(false);
    }
  }

  return {
    importDialog: {
      open,
      openDialog,
      closeDialog,
      loading,
      report,
      fileName,
      confirmText,
      setConfirmText,
      canCommit: Boolean(report && !report.errors.length && parsedState && confirmText === IMPORT_CONFIRMATION),
      committing,
      pickFile,
      commit,
    },
    exporting,
    exportAll,
  };
}
