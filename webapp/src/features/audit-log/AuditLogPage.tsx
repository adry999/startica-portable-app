import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, LoadingState, SearchInput, SearchSelect, SegmentedControl, useTopbarActions } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { usePersonal } from '@shared/personal/usePersonal';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { childNameOf } from '#shared/domain/record-labels.mjs';
import type { RecordType } from '@contracts/record-types.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import { useAuditLog, type AuditRowView, type AuditScopeEntry } from '@shared/audit-log';
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

type RecordCategory = 'children' | 'staff' | 'groups' | 'payments';

// 45a (PROMPT-8 §14): „SearchSelect în Istoric: copii, angajați, grupe, achitări (după sumă)".
// `value` codează categoria ca să știm ce scope să construim la alegere — personalul se salvează
// fără `kind` (vezi personal.routes.mjs), deci categoria lui nu e totuna cu `RecordType`.
function buildRecordOptions(
  records: Pick<RecordsSnapshot, 'children' | 'groups' | 'payments'>,
  staff: { id: string; name: string; archivedAt?: string | null }[],
): { value: string; label: string }[] {
  const children = records.children
    .filter(child => !child.archived)
    .map(child => ({ value: `children:${child.id}`, label: `Copii · ${child.name}` }));
  const staffOptions = staff
    .filter(member => !member.archivedAt)
    .map(member => ({ value: `staff:${member.id}`, label: `Angajați · ${member.name}` }));
  const groups = records.groups.map(group => ({ value: `groups:${group.id}`, label: `Grupe · ${group.name}` }));
  const payments = records.payments
    .filter(payment => !payment.archived)
    .map(payment => ({
      value: `payments:${payment.id}`,
      label: `Achitări · ${formatMoney(payment.amount, payment.currency)} · ${childNameOf(payment, records.children)}`,
    }));
  return [...children, ...staffOptions, ...groups, ...payments];
}

/** Scope-ul pentru `/api/audit/scope`: copilul + achitările lui („înregistrările legate", 45a). */
function scopeForSelection(selection: string, payments: RecordsSnapshot['payments']): AuditScopeEntry[] | null {
  if (!selection) return null;
  const separatorIndex = selection.indexOf(':');
  if (separatorIndex < 0) return null;
  const category = selection.slice(0, separatorIndex) as RecordCategory;
  const id = selection.slice(separatorIndex + 1);
  if (!id) return null;
  if (category === 'children') {
    const linkedPayments = payments.filter(payment => payment.childId === id);
    return [
      { recordType: 'children', recordId: id },
      ...linkedPayments.map(payment => ({ recordType: 'payments', recordId: payment.id })),
    ];
  }
  // Personalul se salvează fără `kind` (null) — vezi buildRecordOptions și personal.routes.mjs.
  if (category === 'staff') return [{ recordType: null, recordId: id }];
  if (category === 'groups') return [{ recordType: 'groups', recordId: id }];
  if (category === 'payments') return [{ recordType: 'payments', recordId: id }];
  return null;
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
  const session = useAppSession();
  const personal = usePersonal();
  const [searchParams, setSearchParams] = useSearchParams();
  // 45a: „Tot istoricul” din fișa copilului (ChildProfileView) deschide Istoricul cu copilul ales
  // — un singur parcurs, ca `nou=1` din ChildrenPage: se citește o dată, apoi se șterge din URL.
  const [selection, setSelection] = useState(() => {
    const recordType = searchParams.get('recordType');
    const recordId = searchParams.get('recordId');
    return recordType && recordId ? `${recordType}:${recordId}` : '';
  });
  useEffect(() => {
    if (!searchParams.get('recordType')) return;
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        next.delete('recordType');
        next.delete('recordId');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const records = session.state.ready ? (session.state.state as RecordsSnapshot) : null;
  const recordOptions = useMemo(
    () => (records ? buildRecordOptions(records, personal.staff) : []),
    [records, personal.staff],
  );
  const scope = records ? scopeForSelection(selection, records.payments) : null;
  const selectedLabel = recordOptions.find(option => option.value === selection)?.label ?? '';

  const auditLogData = useAuditLog(scope);
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

  const recordFilterBar = (
    <div className={styles.recordFilterBar}>
      <SearchSelect
        ariaLabel="Alege o înregistrare"
        placeholder="Copil, angajat, grupă sau achitare…"
        value={selection}
        onChange={setSelection}
        options={recordOptions}
      />
      {selection && (
        <Button variant="link" onClick={() => setSelection('')}>
          Tot istoricul
        </Button>
      )}
    </div>
  );

  if (auditLogData.status === 'loading')
    return (
      <div className={styles.page}>
        {recordFilterBar}
        <LoadingState />
      </div>
    );
  if (auditLogData.status === 'failed')
    return (
      <div className={styles.page}>
        {recordFilterBar}
        <p className={styles.notice}>{auditLogData.failureMessage || 'Istoricul nu a putut fi încărcat.'}</p>
      </div>
    );
  if (auditLogData.status === 'empty')
    return (
      <div className={styles.page}>
        {recordFilterBar}
        <p className={styles.notice}>
          {selection ? `Fără modificări înregistrate pentru ${selectedLabel}.` : 'Nu există modificări înregistrate.'}
        </p>
      </div>
    );

  return (
    <div className={styles.page}>
      {recordFilterBar}
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
        {row.changes.map(change =>
          // 45a: notele medicale nu apar niciodată cu conținut, nici redactat — doar faptul
          // că s-au schimbat (vezi markSensitiveFieldChanges, audit-log.repository.mjs).
          change.field === 'healthNotes' ? (
            <span key={change.field} className={styles.diff}>
              Notă medicală modificată
            </span>
          ) : (
            <span key={change.field} className={styles.diff}>
              <del>{change.beforeLabel}</del> → <strong>{change.afterLabel}</strong>{' '}
              <span className={styles.diffField}>· {change.field}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}
