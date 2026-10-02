import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  FilterMenu,
  LoadingState,
  PeriodFilter,
  SearchInput,
  SearchSelect,
  useTopbarActions,
  type PeriodPreset,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useSyncStatus } from '@shared/api/useSyncStatus';
import { usePersonal } from '@shared/personal/usePersonal';
import { useUrlParams } from '@shared/state/useUrlParams';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { childNameOf } from '#shared/domain/record-labels.mjs';
import type { RecordType } from '@contracts/record-types.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import { useAuditLog, type AuditRowView, type AuditScopeEntry } from '@shared/audit-log';
import styles from './AuditLogPage.module.css';

interface AuditDayGroup {
  dayKey: string;
  dayLabel: string;
  rows: AuditRowView[];
}

/**
 * PROMPT-9 §6: filtrul „Modul” citește `AuditEntry.recordType` — câmpul pe care Istoricul chiar
 * îl are pe fiecare intrare (vezi `audit-log.repository.mjs` — `kind`), nu lista de module de
 * acces din `computer-profile.mjs` (36b), care descrie altceva: ce ecrane poate deschide un
 * calculator, nu ce fel de înregistrare s-a schimbat. `null` acoperă personalul și intrările de
 * configurare (SMS, Telegram, backup, sincronizare) — toate salvează `kind: null`
 * (personal.routes.mjs) și nu pot fi deosebite mai departe fără să analizăm textul acțiunii.
 */
const PERSONAL_MODULE_VALUE = 'personal-setari';

const MODULE_LABELS: Record<string, string> = {
  children: 'Copii',
  payments: 'Achitări',
  groups: 'Grupe',
  expenses: 'Cheltuieli',
  categories: 'Categorii cheltuieli',
  visits: 'Vizite',
  charges: 'Taxe bazin',
  payerAliases: 'Plătitori reținuți',
  services: 'Servicii',
  [PERSONAL_MODULE_VALUE]: 'Personal și setări',
};

function moduleValueOf(recordType: RecordType | null): string {
  return recordType ?? PERSONAL_MODULE_VALUE;
}

/** Opțiunile arată doar modulele cu intrări printre rândurile deja încărcate, cu numărul lor —
 * ca `FilterMenu` să nu propună module goale (categorii, taxe bazin…) cât timp nu au apărut. */
function buildModuleOptions(rows: AuditRowView[]): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = moduleValueOf(row.recordType);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: MODULE_LABELS[value] ?? value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ro'));
}

const CALCULATOR_LOCAL_VALUE = 'local';

/**
 * Filtru „Calculator” — interim, local-only (PROMPT-9 §6): `device_id`/`device_name` pe
 * intrările din istoric vin din §7, care rulează în paralel. Până atunci baza locală nu poate
 * distinge de pe ce calculator a venit o intrare sincronizată — toate cele vizibile aici sunt,
 * prin definiție, din baza acestui calculator — deci opțiunea unică nu elimină niciun rând
 * (vezi `filteredRows` din `AuditLogPage`, care nu testează deloc selecția calculatorului).
 * UI-ul ia deja forma finală (o singură opțiune azi, mai multe calculatoare după §7), ca
 * ecranul să nu se schimbe vizual la acel pas.
 */
function calculatorOptionLabel(deviceName: string): string {
  return deviceName ? `Acest calculator · ${deviceName}` : 'Acest calculator';
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
  const sync = useSyncStatus();
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
  const [search, setSearch] = useState('');

  // PROMPT-9 §6: modul/calculator rămân în URL, ca în Cheltuieli (`ExpensesPage` — §13.2
  // PROMPT-8) — starea supraviețuiește întoarcerii din fișa unui copil. Implicit „tot” (gol) pe
  // amândouă: un link „curat”, fără niciun filtru activ.
  const [urlFilters, setUrlFilters] = useUrlParams({ modul: '', calculator: '' });
  const selectedModules = urlFilters.modul ? urlFilters.modul.split(',') : [];
  const selectedCalculator = urlFilters.calculator ? [urlFilters.calculator] : [];

  function setModuleFilter(values: string[]) {
    setUrlFilters({ modul: values.join(',') });
  }
  function setCalculatorFilter(values: string[]) {
    setUrlFilters({ calculator: values[values.length - 1] ?? '' });
  }

  // Perioada rămâne în `useState`, nu în `useUrlParams` — ca în `ExpensesPage` (§5.1): selectarea
  // unei presetări cere `PeriodFilter` 3 apeluri succesive (onPresetChange + onFromChange +
  // onToChange); `useUrlParams`/`setSearchParams` nu înlănțuie mai multe apeluri din același tur
  // de evenimente (vezi comentariul din `useUrlParams.ts`), deci al doilea/al treilea ar rescrie
  // primul și ar pierde `perioada`/`de`.
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('tot');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const moduleOptions = useMemo(() => buildModuleOptions(auditLogData.rows), [auditLogData.rows]);
  const calculatorOptions = useMemo(
    () => [{ value: CALCULATOR_LOCAL_VALUE, label: calculatorOptionLabel(sync.deviceName) }],
    [sync.deviceName],
  );

  useTopbarActions(
    <span className={styles.topbarSearch}>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Caută copil, achitare…"
        ariaLabel="Caută în istoric"
      />
    </span>,
  );

  const filteredRows = useMemo(() => {
    const needle = normalizeSearchText(search.trim());
    return auditLogData.rows.filter(row => {
      if (selectedModules.length > 0 && !selectedModules.includes(moduleValueOf(row.recordType))) return false;
      if (periodFrom && row.dateKey < periodFrom) return false;
      if (periodTo && row.dateKey > periodTo) return false;
      // Filtrul „Calculator” e interim (vezi calculatorOptionLabel) — nu elimină rânduri.
      if (!needle) return true;
      return (
        normalizeSearchText(row.recordLabel).includes(needle) || normalizeSearchText(row.actionLabel).includes(needle)
      );
    });
  }, [auditLogData.rows, selectedModules, periodFrom, periodTo, search]);

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
      <FilterMenu
        label="Modul"
        ariaLabel="Filtru modul"
        options={moduleOptions}
        selected={selectedModules}
        onChange={setModuleFilter}
      />
      <FilterMenu
        label="Calculator"
        ariaLabel="Filtru calculator"
        options={calculatorOptions}
        selected={selectedCalculator}
        onChange={setCalculatorFilter}
      />
      <PeriodFilter
        preset={periodPreset}
        onPresetChange={setPeriodPreset}
        from={periodFrom}
        onFromChange={setPeriodFrom}
        to={periodTo}
        onToChange={setPeriodTo}
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
