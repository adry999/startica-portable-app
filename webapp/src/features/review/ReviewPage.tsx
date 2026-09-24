import { Badge, Card, useToast, type BadgeTone } from '@shared/ui';
import { useReview, type ReviewRowView } from './useReview';
import styles from './ReviewPage.module.css';

const CATEGORY_TONE: Record<string, BadgeTone> = {
  unassigned: 'pink',
  duplicate: 'pink',
  provisional: 'yellow',
  automatic: 'mint',
  advance: 'orange',
  children: 'neutral',
};

export function ReviewPage() {
  const data = useReview();
  const toast = useToast();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function confirm(paymentId: string) {
    try {
      await data.confirmReview(paymentId);
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
          <strong className={styles.progressValue}>{data.rows.length}</strong>
          <small>din {data.totalItems} fișe / achitări cu observații</small>
        </Card>
        <Card className={styles.progressCard}>
          <p className={styles.progressLabel}>Verificări import confirmate</p>
          <strong className={styles.progressValue}>
            {data.progress.confirmed} / {data.progress.total}
          </strong>
          <small>confirmarea păstrează asocierea și suma existente</small>
        </Card>
        <Card className={styles.progressCard}>
          <p className={styles.progressLabel}>Verificări import rămase</p>
          <strong className={styles.progressValue}>{data.progress.pending}</strong>
          <small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small>
        </Card>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.filterField}>
          Arată
          <select value={data.filter} onChange={event => data.setFilter(event.target.value)}>
            {data.filterOptions.map(([value, label]) => (
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
          value={data.search}
          onChange={event => data.setSearch(event.target.value)}
          aria-label="Caută"
        />
        <button type="button" className={styles.btnGhost} onClick={data.resetFilters}>
          Resetează filtrele
        </button>
      </div>

      <Card className={styles.listCard}>
        {data.rows.length === 0 ? (
          <p className={styles.empty}>Nu există înregistrări pentru filtrul ales.</p>
        ) : (
          data.rows.map(row => (
            <ReviewRow key={`${row.type} ${row.id}`} row={row} onConfirm={confirm} labels={data.labels} />
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
}: {
  row: ReviewRowView;
  onConfirm: (paymentId: string) => void;
  labels: Record<string, string>;
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
        {/* TODO: pasul Formulare — deschide editorul de fișă/achitare complet. */}
        <button type="button" className={styles.linkButton} disabled title="Vine în pasul următor">
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
