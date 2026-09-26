import { Badge, Card, useToast, type BadgeTone } from '@shared/ui';
import { useReview, type ReviewRowView } from './useReview';
import type { ViewKey } from '@shared/view-key';
import styles from './ReviewPage.module.css';

const CATEGORY_TONE: Record<string, BadgeTone> = {
  unassigned: 'pink',
  duplicate: 'pink',
  provisional: 'yellow',
  automatic: 'mint',
  advance: 'orange',
  children: 'neutral',
};

export interface ReviewPageProps {
  onNavigate: (view: ViewKey) => void;
}

export function ReviewPage({ onNavigate }: ReviewPageProps) {
  const reviewData = useReview();
  const toast = useToast();

  if (reviewData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (reviewData.status === 'failed')
    return <p className={styles.notice}>{reviewData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function confirm(paymentId: string) {
    try {
      await reviewData.confirmReview(paymentId);
      toast.show({ message: 'Potrivirea automată a fost marcată ca verificată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <p className={styles.notice}>
        Fiecare rând reprezintă o singură fișă sau achitare. Corectează înainte de a confirma.
      </p>

      <div className={styles.progressRow}>
        <Card className={styles.progressCard}>
          <p className={styles.progressLabel}>Probleme afișate</p>
          <strong className={styles.progressValue}>{reviewData.rows.length}</strong>
          <small>din {reviewData.totalItems} fișe / achitări cu observații</small>
        </Card>
        <Card className={styles.progressCard}>
          <p className={styles.progressLabel}>Verificări import confirmate</p>
          <strong className={styles.progressValue}>
            {reviewData.progress.confirmed} / {reviewData.progress.total}
          </strong>
          <small>confirmarea păstrează asocierea și suma existente</small>
        </Card>
        <Card className={styles.progressCard}>
          <p className={styles.progressLabel}>Verificări import rămase</p>
          <strong className={styles.progressValue}>{reviewData.progress.pending}</strong>
          <small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small>
        </Card>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.filterField}>
          Arată
          <select value={reviewData.filter} onChange={event => reviewData.setFilter(event.target.value)}>
            {reviewData.filterOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <input
          className={styles.search}
          type="search"
          placeholder="Nume, contract, sursă sau observație"
          value={reviewData.search}
          onChange={event => reviewData.setSearch(event.target.value)}
          aria-label="Caută"
        />
        <button type="button" className={styles.btnGhost} onClick={reviewData.resetFilters}>
          Resetează filtrele
        </button>
      </div>

      <Card className={styles.listCard}>
        {reviewData.rows.length === 0 ? (
          <p className={styles.empty}>Nu există înregistrări pentru filtrul ales.</p>
        ) : (
          reviewData.rows.map(row => (
            <ReviewRow
              key={`${row.type} ${row.id}`}
              row={row}
              onConfirm={confirm}
              labels={reviewData.labels}
              onNavigate={onNavigate}
            />
          ))
        )}
      </Card>
    </>
  );
}

function ReviewRow({
  row,
  onConfirm,
  labels,
  onNavigate,
}: {
  row: ReviewRowView;
  onConfirm: (paymentId: string) => void;
  labels: Record<string, string>;
  onNavigate: (view: ViewKey) => void;
}) {
  return (
    <div className={styles.row}>
      <div>
        <p className={styles.rowTitle}>
          <strong>{row.name}</strong> · {row.id}
        </p>
        <div className={styles.tags}>
          {row.categories.map(category => (
            <Badge key={category} tone={CATEGORY_TONE[category] ?? 'neutral'}>
              {labels[category] ?? category}
            </Badge>
          ))}
          {row.confirmed && <Badge tone="mint">Verificat</Badge>}
        </div>
        <small className={styles.rowDetails}>{row.details}</small>
        <small className={styles.rowReasons}>{row.reasons.join(' · ')}</small>
      </div>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => onNavigate(row.type === 'payments' ? 'payments' : 'children')}
        >
          {row.type === 'payments' ? 'Corectează achitarea' : 'Corectează fișa'}
        </button>
        {row.canConfirm && (
          <button type="button" className={styles.btnGhostSmall} onClick={() => onConfirm(row.id)}>
            Confirmă asocierea
          </button>
        )}
      </div>
    </div>
  );
}
