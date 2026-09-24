import { useRef } from 'react';
import { Drawer, useToast } from '@shared/ui';
import type { ExcelImportData } from './useExcelTransfer';
import styles from './ExcelImportDialog.module.css';

export interface ExcelImportDialogProps {
  data: ExcelImportData;
  onClose: () => void;
}

export function ExcelImportDialog({ data, onClose }: ExcelImportDialogProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    const file = fileInputRef.current?.files?.[0];
    if (file) void data.pickFile(file);
  }

  async function commit() {
    try {
      await data.commit();
      toast.show({ message: 'Datele au fost importate din Excel.' });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <Drawer
      open={data.open}
      title="Import Excel"
      width={620}
      onClose={() => {
        data.closeDialog();
        onClose();
      }}
      footer={
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!data.canCommit || data.committing}
          onClick={() => void commit()}
        >
          Confirmă importul
        </button>
      }
    >
      <p className={styles.notice}>
        Importul înlocuiește datele numai după previzualizare, confirmare și backup. Acceptă exportul complet al
        aplicației sau formatul vechi V5.
      </p>

      <label className={styles.field}>
        Fișier Excel
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={pickFile} />
      </label>

      {data.loading && <p className={styles.notice}>Se previzualizează…</p>}

      {data.report && (
        <div className={styles.preview}>
          <p>{data.fileName}</p>
          {data.report.summary && (
            <p>
              {data.report.summary.children} copii · {data.report.summary.payments} achitări ·{' '}
              {data.report.summary.expenses} cheltuieli
            </p>
          )}
          {(data.report.notes ?? []).map(note => (
            <p key={note} className={styles.notice}>
              {note}
            </p>
          ))}
          {data.report.warnings.map((warning, index) => (
            <p key={warning.id ?? index} className={styles.notice}>
              {warning.reason}
            </p>
          ))}
          {data.report.errors.map(error => (
            <p key={error} className={styles.error}>
              {error}
            </p>
          ))}
        </div>
      )}

      <label className={styles.field}>
        Scrie IMPORT pentru a înlocui datele
        <input value={data.confirmText} onChange={event => data.setConfirmText(event.target.value)} />
      </label>
    </Drawer>
  );
}
