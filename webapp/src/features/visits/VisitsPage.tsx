import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDeleteDialog,
  DataTable,
  EMPTY_STATES,
  EmptyState,
  FilterPills,
  Icon,
  IconButton,
  LoadingState,
  MonthCalendar,
  RowMenu,
  SearchInput,
  SearchSelect,
  SegmentedControl,
  SelectionBar,
  resolveEmptyStateTitle,
  useToast,
  useTopbarActions,
  type BadgeTone,
  type DataTableColumn,
  type MonthCalendarDay,
  type PillTone,
} from '@shared/ui';
import { capitalize, formatAge, formatDate, formatDayLabel, formatMonthName } from '#shared/format/date-format.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { downloadCsv } from '@shared/csv-export';
import { formatNameList } from '@shared/format/name-list';
import { usePersistedSort } from '@shared/state/usePersistedSort';
import { useVisits } from './useVisits';
import { VisitFormDrawer } from './VisitFormDrawer';
import { EnrollDrawer } from './EnrollDrawer';
import { STATUS_LABEL, type VisitFormValues } from './visit-form';
import type { Visit, VisitStatus } from '@contracts/record-types.mjs';
import styles from './VisitsPage.module.css';
import { toUserError } from '@shared/api/to-user-error';

const STATUS_TONE: Record<VisitStatus, BadgeTone> = {
  Programată: 'yellow',
  Efectuată: 'mint',
  Neprezentată: 'neutral',
  Înscris: 'orange',
  Renunțat: 'pink',
};

// Clasele CSS rămân ASCII — cheile cu diacritice ale statutului nu sunt nume valide de export CSS Modules.
const STATUS_CHIP_CLASS: Record<VisitStatus, keyof typeof styles> = {
  Programată: 'chipProgramata',
  Efectuată: 'chipEfectuata',
  Neprezentată: 'chipNeprezentata',
  Înscris: 'chipInscris',
  Renunțat: 'chipRenuntat',
};

const STATUS_PILL_CLASS: Record<VisitStatus, keyof typeof styles> = {
  Programată: 'pillProgramata',
  Efectuată: 'pillEfectuata',
  Neprezentată: 'pillNeprezentata',
  Înscris: 'pillInscris',
  Renunțat: 'pillRenuntat',
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

function monthLabel(monthKey: string): string {
  return capitalize(formatMonthName(monthKey));
}

/** Ecranul „Vizite" (2a din Operatiuni.dc.html): calendar + panou de detalii pentru ziua selectată, plus lista completă filtrabilă. */
export interface VisitsPageProps {
  /** Presetează ziua selectată — venit din ?zi= (link „Vezi calendarul" de pe Dashboard). */
  initialDate?: string;
}

export function VisitsPage({ initialDate }: VisitsPageProps = {}) {
  const visitsData = useVisits(initialDate);
  const toast = useToast();
  const [formTarget, setFormTarget] = useState<Visit | 'new' | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Visit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Visit | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // §13.1: cele mai noi primele implicit, alegerea utilizatorului persistă pe pagină.
  const [sort, setSort] = usePersistedSort('sort.visits', { key: 'date', direction: 'desc' });

  useTopbarActions(
    <Button size="header" onClick={() => setFormTarget('new')}>
      + Programează vizită
    </Button>,
  );

  if (visitsData.status === 'loading') return <LoadingState />;
  if (visitsData.status === 'failed')
    return <p className={styles.notice}>{visitsData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function submitVisitForm(values: VisitFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      if (previous) {
        await visitsData.updateVisit(previous, values);
        toast.show({ message: 'Vizită actualizată.' });
      } else {
        await visitsData.createVisit(values);
        toast.show({ message: 'Vizită adăugată.' });
      }
      setFormTarget(null);
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function applyQuickStatus(visit: Visit, status: VisitStatus) {
    try {
      await visitsData.applyQuickStatus(visit, status);
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function toggleArchived(visit: Visit) {
    const nextArchived = !visit.archived;
    try {
      await visitsData.setArchived(visit, nextArchived);
      if (nextArchived) {
        toast.show({
          message: 'Vizită arhivată.',
          actionLabel: 'Anulează',
          onAction: () => {
            visitsData.setArchived(visit, false).catch(error => toast.show({ message: toUserError(error) }));
          },
        });
      }
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function deleteForever(visit: Visit) {
    try {
      await visitsData.deleteForever(visit.id);
      toast.show({ message: 'Vizită ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  const selectedVisits = visitsData.rows.filter(visit => selectedRowKeys.has(visit.id));

  async function archiveSelectedVisits() {
    const targetArchived = !visitsData.showArchived;
    if (selectedVisits.length === 0) return;
    try {
      for (const visit of selectedVisits) await visitsData.setArchived(visit, targetArchived);
      setSelectedRowKeys(new Set());
      const single = selectedVisits.length === 1;
      toast.show({
        message: `${selectedVisits.length} ${single ? 'vizită' : 'vizite'} ${targetArchived ? (single ? 'arhivată' : 'arhivate') : single ? 'dezarhivată' : 'dezarhivate'}.`,
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  function exportSelectedVisits() {
    if (selectedVisits.length === 0) return;
    downloadCsv(
      `vizite-selectate-${selectedVisits.length}.csv`,
      ['Data', 'Ora', 'Copil', 'Părinte', 'Telefon', 'Statut'],
      selectedVisits.map(visit => [
        visit.date,
        visit.time,
        visit.name,
        visit.parent,
        visit.phone ?? '',
        STATUS_LABEL[visit.status],
      ]),
    );
  }

  async function deleteSelectedVisitsForever() {
    if (selectedVisits.length === 0) return;
    try {
      await visitsData.deleteManyForever(selectedVisits.map(visit => visit.id));
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${selectedVisits.length} ${selectedVisits.length === 1 ? 'vizită ștearsă' : 'vizite șterse'} definitiv.`,
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function submitEnroll(overrides: { fee: string; groupId: string; attendanceDate: string }) {
    if (!enrollTarget) return;
    try {
      await visitsData.enrollChild(enrollTarget, overrides);
      setEnrollTarget(null);
      toast.show({ message: 'Copil înscris. Vizita a fost marcată „Înscris”.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  const selectedDayVisits = visitsData.selectedDate
    ? (visitsData.weeks.flat().find(day => day.date === visitsData.selectedDate)?.visits ?? [])
    : [];

  const visitsByDate = new Map(visitsData.weeks.flat().map(day => [day.date, day.visits]));
  const monthCalendarDays: MonthCalendarDay[] = visitsData.weeks.flat().map(day => ({
    date: day.date,
    dayNumber: day.day,
    isCurrentMonth: day.inMonth,
    isToday: day.isToday,
    events: [],
  }));

  const quickFilter: 'all' | 'scheduled' | 'archived' = visitsData.showArchived
    ? 'archived'
    : visitsData.statusFilter === 'Programată'
      ? 'scheduled'
      : 'all';

  function setQuickFilter(next: 'all' | 'scheduled' | 'archived') {
    visitsData.setShowArchived(next === 'archived');
    visitsData.setStatusFilter(next === 'scheduled' ? 'Programată' : '');
    setSelectedRowKeys(new Set());
  }

  const quickFilterCounts = {
    all: visitsData.records.visits.filter(v => !v.archived).length,
    scheduled: visitsData.records.visits.filter(v => !v.archived && v.status === 'Programată').length,
    archived: visitsData.records.visits.filter(v => v.archived).length,
  };

  const upcoming = visitsData.records.visits
    .filter(visit => !visit.archived && visit.status === 'Programată')
    .filter(visit => visit.date.slice(0, 7) === visitsData.month)
    .filter(visit => visit.date !== visitsData.selectedDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5);

  const columns: DataTableColumn<Visit>[] = [
    {
      key: 'date',
      header: 'Data',
      sortValue: row => `${row.date} ${row.time}`,
      render: row => (
        <div>
          <strong>{formatDate(row.date)}</strong>
          <br />
          <small className={styles.dim}>{row.time}</small>
        </div>
      ),
    },
    {
      key: 'child',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (
        <div>
          <strong>{row.name}</strong>
          {row.birthDate && (
            <>
              <br />
              <small className={styles.dim}>{formatAge(row.birthDate)}</small>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Părinte / telefon',
      render: row => (
        <div>
          <span>{row.parent}</span>
          {row.phone && (
            <>
              <br />
              <small className={styles.dim}>{row.phone}</small>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Grupă dorită',
      render: row => (row.desiredGroupId ? groupNameOf(row.desiredGroupId, visitsData.groups) : '—'),
    },
    {
      key: 'note',
      header: 'Notă',
      render: row => <span className={styles.dim}>{row.notes || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      render: row => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: row => (
        <RowMenu
          items={[
            { label: 'Editează', onClick: () => setFormTarget(row) },
            { label: 'Reprogramează', onClick: () => setFormTarget(row) },
            { label: row.archived ? 'Dezarhivează' : 'Arhivează', onClick: () => void toggleArchived(row) },
            {
              label: 'Șterge',
              danger: true,
              disabled: !row.archived,
              title: row.archived ? undefined : 'Arhivează întâi vizita',
              onClick: () => setDeleteTarget(row),
            },
          ]}
        />
      ),
    },
  ];

  // R9: „Fără rezultate" (filtre/căutare active) e generic și în afara catalogului — DataTable îl
  // arată singur cât timp `hasActiveFilters` e adevărat; abia sub el, tabelul chiar gol (nicio
  // vizită înregistrată vreodată) arată catalogul `vizite.first`.
  const activeFilterChips: { label: string; onClear: () => void }[] = [];
  if (visitsData.search) {
    activeFilterChips.push({ label: `Căutare: ${visitsData.search}`, onClear: () => visitsData.setSearch('') });
  }
  if (visitsData.statusFilter) {
    activeFilterChips.push({
      label: `Statut: ${STATUS_LABEL[visitsData.statusFilter as VisitStatus]}`,
      onClear: () => visitsData.setStatusFilter(''),
    });
  }
  if (visitsData.showArchived) {
    activeFilterChips.push({ label: 'Arhivate', onClear: () => visitsData.setShowArchived(false) });
  }
  if (visitsData.selectedDate) {
    activeFilterChips.push({
      label: formatDate(visitsData.selectedDate),
      onClear: () => visitsData.setSelectedDate(null),
    });
  }

  function clearVisitFilters() {
    visitsData.setSearch('');
    visitsData.setStatusFilter('');
    visitsData.setShowArchived(false);
    visitsData.setSelectedDate(null);
  }

  return (
    <>
      <div className={styles.funnelRow}>
        <span className={`${styles.funnelPill} ${styles.funnelYellow}`}>
          <b>{visitsData.funnel.scheduled}</b>
          <span>programate</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelMint}`}>
          <b>{visitsData.funnel.done}</b>
          <span>efectuate</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelOrange}`}>
          <b>{visitsData.funnel.enrolled}</b>
          <span>înscriși</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelPink}`}>
          <b>{visitsData.funnel.withdrew}</b>
          <span>renunțat</span>
        </span>
        <span className={styles.funnelCaption}>ultimele 12 luni</span>
      </div>

      <div className={styles.layoutGrid}>
        <Card className={styles.calendarCard}>
          <div className={styles.calendarToolbar}>
            <strong className={styles.calendarMonth}>{monthLabel(visitsData.month)}</strong>
            <Button variant="ghost" onClick={visitsData.goToToday}>
              Azi
            </Button>
            <IconButton
              className={styles.arrowButton}
              icon="chevron-left"
              ariaLabel="Luna anterioară"
              onClick={visitsData.goToPreviousMonth}
            />
            <IconButton
              className={styles.arrowButton}
              icon="chevron-right"
              ariaLabel="Luna următoare"
              onClick={visitsData.goToNextMonth}
            />
          </div>

          <MonthCalendar
            weekdayLabels={WEEKDAY_LABELS}
            days={monthCalendarDays}
            selected={visitsData.selectedDate ?? undefined}
            onSelect={date => visitsData.setSelectedDate(visitsData.selectedDate === date ? null : date)}
            cellHeight={110}
            renderCell={day => {
              const visits = visitsByDate.get(day.date) ?? [];
              return (
                <>
                  <strong className={styles.calendarDayNumber}>{day.dayNumber}</strong>
                  {visits.length > 3 ? (
                    <small className={styles.dim}>{visits.length} vizite</small>
                  ) : (
                    visits.map(visit => (
                      <span
                        key={visit.id}
                        className={`${styles.calendarChip} ${styles[STATUS_CHIP_CLASS[visit.status]]}`}
                      >
                        {visit.time} {visit.name}
                      </span>
                    ))
                  )}
                </>
              );
            }}
          />
        </Card>

        <div className={styles.detailColumn}>
          {!visitsData.selectedDate && (
            <Card className={styles.detailEmpty}>
              <p>Alege o zi din calendar pentru a vedea detaliile vizitelor.</p>
            </Card>
          )}

          {visitsData.selectedDate && selectedDayVisits.length === 0 && (
            <Card className={styles.detailEmpty}>
              <EmptyState
                size="compact"
                variant={EMPTY_STATES['vizite.day'].variant}
                title={resolveEmptyStateTitle(EMPTY_STATES['vizite.day'])}
                action={{ label: EMPTY_STATES['vizite.day'].actionLabel ?? '', onClick: () => setFormTarget('new') }}
              />
            </Card>
          )}

          {selectedDayVisits.map(visit => (
            <Card key={visit.id} className={styles.detailCard}>
              <span className={styles.detailEyebrow}>{formatDayLabel(visit.date)}</span>
              <div className={styles.detailHead}>
                <span className={styles.detailTime}>{visit.time}</span>
                <div className={styles.detailWho}>
                  <span className={styles.detailName}>
                    {visit.name}
                    {visit.birthDate && ` · ${formatAge(visit.birthDate)}`}
                  </span>
                  <span className={styles.detailParent}>
                    Părinte: {visit.parent}
                    {visit.phone && ` · ${visit.phone}`}
                  </span>
                </div>
              </div>
              <div className={styles.detailMeta}>
                <span>Grupă dorită</span>
                <span>{visit.desiredGroupId ? groupNameOf(visit.desiredGroupId, visitsData.groups) : '—'}</span>
                {visit.notes && (
                  <>
                    <span>Notă</span>
                    <span>{visit.notes}</span>
                  </>
                )}
              </div>

              {(visitsData.allowedNextStatuses(visit.status).length > 0 || visit.status === 'Efectuată') && (
                <>
                  <span className={styles.detailSectionLabel}>Cum a decurs vizita?</span>
                  <div className={styles.quickStatusGrid}>
                    {visitsData.allowedNextStatuses(visit.status).map(status => (
                      <Button
                        key={status}
                        className={`${styles.quickStatus} ${styles[STATUS_PILL_CLASS[status]]}`}
                        onClick={() => void applyQuickStatus(visit, status)}
                      >
                        {STATUS_LABEL[status]}
                      </Button>
                    ))}
                    {visit.status === 'Efectuată' && (
                      <Button
                        className={`${styles.quickStatus} ${styles.pillInscris}`}
                        onClick={() => setEnrollTarget(visit)}
                      >
                        S-a înscris
                      </Button>
                    )}
                  </div>
                </>
              )}

              <div className={styles.detailActions}>
                <Button variant="link" className={styles.detailLink} onClick={() => setFormTarget(visit)}>
                  Editează
                </Button>
                <span className={styles.detailActionsRight}>
                  <Button variant="link" className={styles.detailLinkMuted} onClick={() => setFormTarget(visit)}>
                    Reprogramează
                  </Button>
                  <Button variant="link" className={styles.detailLinkMuted} onClick={() => void toggleArchived(visit)}>
                    {visit.archived ? 'Dezarhivează' : 'Arhivează'}
                  </Button>
                </span>
              </div>
            </Card>
          ))}

          <Card className={styles.upcomingCard}>
            <span className={styles.detailSectionLabel}>Următoarele vizite</span>
            {upcoming.length === 0 ? (
              <EmptyState
                size="compact"
                variant={EMPTY_STATES['vizite.month.rest'].variant}
                title={resolveEmptyStateTitle(EMPTY_STATES['vizite.month.rest'])}
              />
            ) : (
              upcoming.map(visit => (
                <Button
                  key={visit.id}
                  variant="ghost"
                  className={styles.upcomingRow}
                  onClick={() => visitsData.setSelectedDate(visit.date)}
                >
                  <span className={styles.upcomingWhen}>
                    {formatDate(visit.date)} · {visit.time}
                  </span>
                  <span className={styles.upcomingName}>
                    {visit.name}
                    {visit.birthDate && ` · ${formatAge(visit.birthDate)}`}
                  </span>
                  <span className={styles.upcomingMeta}>
                    Părinte: {visit.parent}
                    {visit.phone && ` · ${visit.phone}`}
                  </span>
                  {visit.desiredGroupId && (
                    <span className={styles.upcomingMeta}>
                      Grupă dorită: {groupNameOf(visit.desiredGroupId, visitsData.groups)}
                    </span>
                  )}
                </Button>
              ))
            )}
          </Card>
        </div>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.tableHeadRow}>
          <p className={styles.tableTitle}>Toate vizitele</p>
          <SearchInput
            value={visitsData.search}
            onChange={visitsData.setSearch}
            placeholder="Caută copil, părinte sau telefon…"
            ariaLabel="Caută vizită"
          />
          <SegmentedControl
            ariaLabel="Filtru rapid"
            value={quickFilter}
            onChange={setQuickFilter}
            options={[
              { value: 'all', label: `Toate · ${quickFilterCounts.all}` },
              { value: 'scheduled', label: `Programate · ${quickFilterCounts.scheduled}` },
              { value: 'archived', label: `Arhivate · ${quickFilterCounts.archived}` },
            ]}
          />
          <SearchSelect
            className={styles.filterSelect}
            ariaLabel="Filtru perioadă"
            value={visitsData.allMonths ? 'all' : 'month'}
            onChange={value => visitsData.setAllMonths(value === 'all')}
            options={[
              { value: 'month', label: 'Luna curentă' },
              { value: 'all', label: 'Toate lunile' },
            ]}
          />
          {visitsData.selectedDate && (
            <Button
              variant="ghost"
              className={styles.selectedDateClear}
              onClick={() => visitsData.setSelectedDate(null)}
            >
              {formatDate(visitsData.selectedDate)}
              <Icon name="close" size={14} />
            </Button>
          )}
        </div>

        <FilterPills
          groups={[
            {
              label: 'Statut',
              value: visitsData.statusFilter,
              onChange: visitsData.setStatusFilter,
              options: [
                { value: '', label: 'Toate', tone: 'neutral' },
                ...(['Programată', 'Efectuată', 'Neprezentată', 'Înscris', 'Renunțat'] as VisitStatus[]).map(
                  status => ({ value: status, label: STATUS_LABEL[status], tone: STATUS_TONE[status] as PillTone }),
                ),
              ],
            },
          ]}
          trailing={`${visitsData.rows.length} vizite`}
        />

        {selectedRowKeys.size > 0 && (
          <SelectionBar label={<>{selectedRowKeys.size} selectate</>} onCancel={() => setSelectedRowKeys(new Set())}>
            <Button onClick={exportSelectedVisits}>Exportă</Button>
            <Button className={styles.selectionArchive} onClick={() => void archiveSelectedVisits()}>
              {visitsData.showArchived ? 'Dezarhivează' : 'Arhivează'}
            </Button>
            {visitsData.showArchived && (
              <Button className={styles.selectionDeleteForever} onClick={() => setBulkDeleteOpen(true)}>
                Șterge definitiv
              </Button>
            )}
          </SelectionBar>
        )}

        <DataTable
          bare
          columns={columns}
          rows={visitsData.rows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          onRowClick={row => visitsData.setSelectedDate(row.date)}
          rowClassName={row => (row.date === visitsData.selectedDate ? styles.selectedDayRow : undefined)}
          sort={sort}
          onSortChange={setSort}
          empty="vizite.first"
          hasActiveFilters={activeFilterChips.length > 0}
          activeFilterLabels={activeFilterChips.map(chip => chip.label)}
          onClearFilters={clearVisitFilters}
        />
        <p className={styles.tableHint}>Click pe rând deschide vizita în calendar.</p>
      </Card>

      <VisitFormDrawer
        key={
          formTarget === 'new' ? `new-${visitsData.selectedDate ?? ''}` : formTarget === null ? 'closed' : formTarget.id
        }
        target={formTarget}
        groups={visitsData.groups}
        defaultDate={visitsData.selectedDate ?? undefined}
        onSubmit={submitVisitForm}
        onClose={() => setFormTarget(null)}
      />
      <EnrollDrawer
        key={enrollTarget === null ? 'closed' : enrollTarget.id}
        visit={enrollTarget}
        groups={visitsData.groups}
        onSubmit={submitEnroll}
        onClose={() => setEnrollTarget(null)}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Ștergere definitivă"
        description={
          deleteTarget
            ? `Ștergi definitiv vizita lui ${deleteTarget.name}? Nu poate fi anulată, spre deosebire de arhivare.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteForever(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Ștergi definitiv ${selectedVisits.length} ${selectedVisits.length === 1 ? 'vizită' : 'vizite'}?`}
        description={`${formatNameList(selectedVisits.map(visit => visit.name))}. Doar înregistrarea. Nu poate fi anulată.`}
        confirmLabel={`Șterge ${selectedVisits.length} ${selectedVisits.length === 1 ? 'vizită' : 'vizite'}`}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteSelectedVisitsForever();
          setBulkDeleteOpen(false);
        }}
      />
    </>
  );
}
