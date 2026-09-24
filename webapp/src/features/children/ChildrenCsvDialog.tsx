import { useEffect, useRef } from 'react';
import { Drawer, useToast } from '@shared/ui';
import { useChildrenCsvImport } from './useChildrenCsvImport';
import styles from './ChildrenCsvDialog.module.css';

export interface ChildrenCsvDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChildrenCsvDialog({ open, onClose }: ChildrenCsvDialogProps) {
  const data = useChildrenCsvImport();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Se deschide doar la tranziția `open` false → true a prop-ului; restul stării interne (fișier, raport) trăiește în hook.
  useEffect(() => {
    if (open) data.openDialog();
  }, [open]);

  function handleClose() {
    data.closeDialog();
    onClose();
  }

  function pickFile() {
    const file = fileInputRef.current?.files?.[0];
    if (file) void data.pickFile(file);
  }

  async function commit() {
    try {
      const { imported } = await data.commit();
      toast.show({
        message: `${imported} copii importați. Fișele existente, achitările și cheltuielile au fost păstrate.`,
      });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <Drawer
      open={open}
      title="Import CSV — copii"
      width={620}
      onClose={handleClose}
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
      <label className={styles.field}>
        Fișier CSV
        <input ref={fileInputRef} type="file" accept=".csv" onChange={pickFile} />
      </label>

      {data.loading && <p className={styles.notice}>Se previzualizează…</p>}
      {data.error && <p className={styles.error}>{data.error}</p>}

      {data.report && (
        <div className={styles.preview}>
          <p>
            {data.report.additions.length} adăugări · {data.report.skipped} neschimbate · {data.report.conflicts}{' '}
            conflicte, din {data.report.total} rânduri.
          </p>
          {data.report.warnings.map(warning => (
            <p key={warning} className={styles.notice}>
              {warning}
            </p>
          ))}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rând</th>
                <th>Contract</th>
                <th>Nume</th>
                <th>Rezultat</th>
              </tr>
            </thead>
            <tbody>
              {data.report.rows.map(row => (
                <tr key={row.line}>
                  <td>{row.line}</td>
                  <td>{row.contractNumber}</td>
                  <td>{row.name}</td>
                  <td>
                    {row.action}
                    {row.reason ? ` — ${row.reason}` : ''}
                    {row.warnings.length > 0 && <small> ({row.warnings.join(', ')})</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className={styles.field}>
        Scrie IMPORT COPII pentru a confirma
        <input value={data.confirmText} onChange={event => data.setConfirmText(event.target.value)} />
      </label>
    </Drawer>
  );
}
