import { useMemo, useState } from 'react';
import { Badge, Button, LoadingState, SearchInput, SegmentedControl, useTopbarActions } from '@shared/ui';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import type { RecordType } from '@contracts/record-types.mjs';
import { useAuditLog, type AuditRowView } from './useAuditLog';
import styles from './AuditLogPage.module.css';

type AuditFilter = 'toate' | 'copii' | 'achitari' | 'grupe';

const FILTER_OPTIONS: { value: AuditFilter; label: string }[] = [
  { value: 'toate', label: 'Tot' },
  { value: 'copii', label: 'Copii' },
  { value: 'achitari', label: 'Achitări' },
  { value: 'grupe', label: 'Grupe' },
];

const FILTER_RECORD_TYPE: Record<Exclude<AuditFilter, 'toate'>, RecordType> = {
  copii: 'children',
  achitari: 'payments',
  grupe: 'groups',
};

interface AuditDayGroup {
  dayKey: string;
  dayLabel: string;
  rows: AuditRowView[];
}

function groupByDay(rows: AuditRowView[]): AuditDayGroup[] {
  const groups: AuditDayGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === row.dayKey) {
      last.rows.push(row);
    } else {
      groups.push({ dayKey: row.dayKey, dayLabel: row.dayLabel, rows: [row] });
    }
  }
  return groups;
}

export function AuditLogPage() {
  const auditLogData = useAuditLog();
  const [filter, setFilter] = useState<AuditFilter>('toate');
  const [search, setSearch] = useState('');

  useTopbarActions(
    <>
      <span className={styles.topbarSearch}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Caută copil, achitare…"
          ariaLabel="Caută în istoric"
        />
      </span>
      <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={setFilter} ariaLabel="Filtru istoric" />
    </>,
  );

  const filteredRows = useMemo(() => {
    const needle = normalizeSearchText(search.trim());
    return auditLogData.rows.filter(row => {
      if (filter !== 'toate' && row.recordType !== FILTER_RECORD_TYPE[filter]) return false;
      if (!needle) return true;
      return (
        normalizeSearchText(row.recordLabel).includes(needle) || normalizeSearchText(row.actionLabel).includes(needle)
      );
    });
  }, [auditLogData.rows, filter, search]);

  const groups = useMemo(() => groupByDay(filteredRows), [filteredRows]);

  if (auditLogData.status === 'loading') return <LoadingState />;
  if (auditLogData.status === 'failed')
    return <p className={styles.notice}>{auditLogData.failureMessage || 'Istoricul nu a putut fi încărcat.'}</p>;
  if (auditLogData.status === 'empty') return <p className={styles.notice}>Nu există modificări înregistrate.</p>;

  return (
    <div className={styles.page}>
      {groups.length === 0 && <p className={styles.notice}>Niciun rezultat pentru filtrele alese.</p>}
      {groups.map(group => (
        <section key={group.dayKey} className={styles.dayGroup}>
          <h2 className={styles.dayTitle}>{group.dayLabel}</h2>
          <div className={styles.dayCard}>
            {group.rows.map(row => (
              <AuditRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      ))}
      {auditLogData.hasMore && (
        <Button
          variant="outline"
          className={styles.loadMore}
          disabled={auditLogData.isLoadingMore}
          onClick={auditLogData.loadMore}
        >
          {auditLogData.isLoadingMore ? 'Se încarcă…' : 'Mai multe'}
        </Button>
      )}
      {auditLogData.failureMessage && auditLogData.status === 'ready' && (
        <p className={styles.error}>{auditLogData.failureMessage}</p>
      )}
    </div>
  );
}

function AuditRow({ row }: { row: AuditRowView }) {
  return (
    <div className={styles.row}>
      <span className={styles.time}>{row.timeLabel}</span>
      <span className={styles.badgeSlot}>
        <Badge tone={row.actionTone}>{row.actionLabel}</Badge>
      </span>
      <div className={styles.rowBody}>
        <span className={styles.recordLabel}>{row.recordLabel}</span>
        {row.changes.map(change => (
          <span key={change.field} className={styles.diff}>
            <del>{change.beforeLabel}</del> → <strong>{change.afterLabel}</strong>{' '}
            <span className={styles.diffField}>· {change.field}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
