import { Badge, Button, LoadingState } from '@shared/ui';
import { useAccessLog, type AccessRowView } from '@shared/audit-log';
import styles from './AuditLogPage.module.css';

interface AccessDayGroup {
  dayKey: string;
  dayLabel: string;
  rows: AccessRowView[];
}

function groupByDay(rows: AccessRowView[]): AccessDayGroup[] {
  const groups: AccessDayGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === row.dayKey) last.rows.push(row);
    else groups.push({ dayKey: row.dayKey, dayLabel: row.dayLabel, rows: [row] });
  }
  return groups;
}

/**
 * Fila „Acces” (§7, 36g — `docs/design/screens/31-profiluri-calculator.md`): evenimentele
 * `access.pin_ok` / `access.pin_fail` / `access.blocked` / `access.locked`, un jurnal simplu,
 * fără filtre proprii (doar pe profil Complet — serverul respinge restul cu 403, vezi
 * `useAccessLog`). Montat ca a doua filă din `AuditLogPage` (Tabs „Istoric” / „Acces”).
 */
export function AccessLogPanel() {
  const data = useAccessLog();

  if (data.status === 'loading')
    return (
      <div className={styles.page}>
        <LoadingState />
      </div>
    );
  if (data.status === 'failed')
    return (
      <div className={styles.page}>
        <p className={styles.notice}>
          {data.failureMessage || 'Fila Acces e disponibilă doar pe calculatorul cu profil Complet.'}
        </p>
      </div>
    );
  if (data.status === 'empty')
    return (
      <div className={styles.page}>
        <p className={styles.notice}>Nu există evenimente de acces înregistrate.</p>
      </div>
    );

  const groups = groupByDay(data.rows);
  return (
    <div className={styles.page}>
      {groups.map(group => (
        <section key={group.dayKey} className={styles.dayGroup}>
          <h2 className={styles.dayTitle}>{group.dayLabel}</h2>
          <div className={styles.dayCard}>
            {group.rows.map(row => (
              <AccessRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      ))}
      {data.hasMore && (
        <Button variant="outline" className={styles.loadMore} disabled={data.isLoadingMore} onClick={data.loadMore}>
          {data.isLoadingMore ? 'Se încarcă…' : 'Mai multe'}
        </Button>
      )}
      {data.failureMessage && data.status === 'ready' && <p className={styles.error}>{data.failureMessage}</p>}
    </div>
  );
}

function AccessRow({ row }: { row: AccessRowView }) {
  return (
    <div className={styles.row}>
      <span className={styles.time}>{row.timeLabel}</span>
      <span className={styles.badgeSlot}>
        <Badge tone={row.actionTone}>{row.actionLabel}</Badge>
      </span>
      <div className={styles.rowBody}>
        <span className={styles.recordLabel}>{row.moduleLabel || 'Acces'}</span>
        <span className={styles.diff}>{row.deviceName}</span>
      </div>
    </div>
  );
}
