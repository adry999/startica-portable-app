import { ErrorState, LoadingState } from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import styles from './BackupPreviewTable.module.css';

export interface BackupPreviewDatabaseRow {
  id: string;
  name: string;
  kind: 'branch' | 'common';
  children: number;
  payments: number;
  expenses: number;
}

export interface BackupPreviewTableProps {
  /** Previzualizarea e în curs de încărcare (apelul la `/api/backup-preview`). */
  loading?: boolean;
  /** Mesajul unei arhive respinse (versiune mai nouă, numărătoare greșită) — ecranul care
   * folosește acest tabel arată de obicei `RestoreRejected`, nu acest card, dar `error` rămâne
   * aici ca stare proprie pentru Storybook/teste (COMPONENTE.md §3b). */
  error?: string;
  onRetry?: () => void;
  fileName: string;
  createdAt?: string;
  appVersion?: string;
  /** Un rând per bază din manifest — gol doar dacă previzualizarea încă nu a sosit. */
  databases: BackupPreviewDatabaseRow[];
}

function total(databases: BackupPreviewDatabaseRow[], key: 'children' | 'payments' | 'expenses') {
  return databases.filter(row => row.kind === 'branch').reduce((sum, row) => sum + row[key], 0);
}

/** 46b — previzualizarea restaurării dintr-o arhivă completă: rând per bază + Total,
 * din manifest.json, plus nota despre renumărarea de după restaurare. */
export function BackupPreviewTable({
  loading = false,
  error = '',
  onRetry,
  fileName,
  createdAt,
  appVersion,
  databases,
}: BackupPreviewTableProps) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Backup-ul nu poate fi previzualizat" description={error} onRetry={onRetry} />;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Din backup</span>
        <h2 className={styles.fileName}>{fileName}</h2>
        {(createdAt || appVersion) && (
          <span className={styles.meta}>
            {createdAt ? `Creat pe ${formatDateTime(createdAt)}` : ''}
            {createdAt && appVersion ? ' · ' : ''}
            {appVersion ? `Startica ${appVersion}` : ''}
          </span>
        )}
      </div>

      {databases.length === 0 ? (
        <p className={styles.empty}>Backup fără nicio bază de date.</p>
      ) : (
        <div className={styles.table}>
          <div className={styles.row}>
            <span>Bază</span>
            <span className={styles.num}>Copii</span>
            <span className={styles.num}>Achitări</span>
            <span className={styles.num}>Cheltuieli</span>
          </div>
          {databases.map(row => (
            <div className={styles.row} key={row.id}>
              <span className={row.kind === 'common' ? styles.rowLabelMuted : undefined}>
                {row.kind === 'common' ? `${row.name} (personal, bazin, curs, planuri)` : row.name}
              </span>
              <span className={styles.num}>{row.kind === 'common' ? '—' : row.children}</span>
              <span className={styles.num}>{row.kind === 'common' ? '—' : row.payments}</span>
              <span className={styles.num}>{row.kind === 'common' ? '—' : row.expenses}</span>
            </div>
          ))}
          <div className={`${styles.row} ${styles.rowTotal}`}>
            <span>Total</span>
            <span className={styles.num}>{total(databases, 'children')}</span>
            <span className={styles.num}>{total(databases, 'payments')}</span>
            <span className={styles.num}>{total(databases, 'expenses')}</span>
          </div>
        </div>
      )}

      <p className={styles.note}>
        După restaurare numărăm din nou fiecare bază. Dacă nu corespunde cu tabelul, aplicația nu se deschide și
        fișierul rămâne neatins.
      </p>
    </div>
  );
}
