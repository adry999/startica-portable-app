import { Card } from '@shared/ui';
import { useAuditLog, type AuditRowView } from './useAuditLog';
import styles from './AuditLogPage.module.css';

export function AuditLogPage() {
  const auditLogData = useAuditLog();

  if (auditLogData.status === 'loading') return <p className={styles.notice}>Se încarcă istoricul…</p>;
  if (auditLogData.status === 'failed')
    return <p className={styles.notice}>{auditLogData.failureMessage || 'Istoricul nu a putut fi încărcat.'}</p>;
  if (auditLogData.status === 'empty') return <p className={styles.notice}>Nu există modificări înregistrate.</p>;

  return (
    <Card className={styles.listCard}>
      {auditLogData.rows.map(row => (
        <AuditRow key={row.id} row={row} />
      ))}
      {auditLogData.hasMore && (
        <button
          type="button"
          className={styles.loadMore}
          disabled={auditLogData.isLoadingMore}
          onClick={auditLogData.loadMore}
        >
          {auditLogData.isLoadingMore ? 'Se încarcă…' : 'Mai multe'}
        </button>
      )}
      {auditLogData.failureMessage && auditLogData.status === 'ready' && (
        <p className={styles.error}>{auditLogData.failureMessage}</p>
      )}
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
