import { Card } from '@shared/ui';
import { useAuditLog, type AuditRowView } from './useAuditLog';
import styles from './AuditLogPage.module.css';

export function AuditLogPage() {
  const data = useAuditLog();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă istoricul…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Istoricul nu a putut fi încărcat.'}</p>;
  if (data.status === 'empty') return <p className={styles.notice}>Nu există modificări înregistrate.</p>;

  return (
    <Card className={styles.listCard}>
      {data.rows.map(row => (
        <AuditRow key={row.id} row={row} />
      ))}
      {data.hasMore && (
        <button type="button" className={styles.loadMore} disabled={data.isLoadingMore} onClick={data.loadMore}>
          {data.isLoadingMore ? 'Se încarcă…' : 'Mai multe'}
        </button>
      )}
      {data.failureMessage && data.status === 'ready' && <p className={styles.error}>{data.failureMessage}</p>}
    </Card>
  );
}

function AuditRow({ row }: { row: AuditRowView }) {
  return (
    <details className={styles.entry}>
      <summary>
        {row.occurredAtLabel} · {row.action} · {row.recordLabel}
      </summary>
      <pre className={styles.diff}>
        {row.changes.map(change => `${change.field}: ${change.beforeLabel} → ${change.afterLabel}`).join('\n')}
      </pre>
    </details>
  );
}
