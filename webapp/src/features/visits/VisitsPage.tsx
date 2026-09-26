import { useState } from 'react';
import { Badge, Card, DataTable, SearchSelect, useToast, type BadgeTone, type DataTableColumn } from '@shared/ui';
import { formatAge, formatDate } from '#shared/format/date-format.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { useTopbarActions } from '../../app/shell/TopbarActions';
import { useVisits } from './useVisits';
import { VisitFormDrawer } from './VisitFormDrawer';
import { EnrollDrawer } from './EnrollDrawer';
import type { VisitFormValues } from './visit-form';
import type { Visit, VisitStatus } from '@contracts/record-types.mjs';
import styles from './VisitsPage.module.css';

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

const WEEKDAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('ro-RO', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(dateStr: string): string {
  const label = new Date(`${dateStr}T00:00:00`).toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ecranul „Vizite" (2a din Operatiuni.dc.html): calendar + panou de detalii pentru ziua selectată, plus lista completă filtrabilă. */
export interface VisitsPageProps {
  /** Presetează ziua selectată — venit din ?zi= (link „Vezi calendarul" de pe Dashboard). */
  initialDate?: string;
}

export function VisitsPage({ initialDate }: VisitsPageProps = {}) {
  const data = useVisits(initialDate);
  const toast = useToast();
  const [formTarget, setFormTarget] = useState<Visit | 'new' | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Visit | null>(null);

  useTopbarActions(
    <button type="button" className={styles.btnPrimary} onClick={() => setFormTarget('new')}>
      + Programează vizită
    </button>,
  );

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function submitVisitForm(values: VisitFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      if (previous) {
        await data.updateVisit(previous, values);
        toast.show({ message: 'Vizită actualizată.' });
      } else {
        await data.createVisit(values);
        toast.show({ message: 'Vizită adăugată.' });
      }
      setFormTarget(null);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function applyQuickStatus(visit: Visit, status: VisitStatus) {
    try {
      await data.applyQuickStatus(visit, status);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function toggleArchived(visit: Visit) {
    try {
      await data.setArchived(visit, !visit.archived);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteForever(visit: Visit) {
    if (!window.confirm(`Ștergi definitiv vizita lui ${visit.name}? Nu poate fi anulată, spre deosebire de arhivare.`))
      return;
    try {
      await data.deleteForever(visit.id);
      toast.show({ message: 'Vizită ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitEnroll(overrides: { fee: string; groupId: string; attendanceDate: string }) {
    if (!enrollTarget) return;
    try {
      await data.enrollChild(enrollTarget, overrides);
      setEnrollTarget(null);
      toast.show({ message: 'Copil înscris. Vizita a fost marcată „Înscris”.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const selectedDayVisits = data.selectedDate
    ? (data.weeks.flat().find(day => day.date === data.selectedDate)?.visits ?? [])
    : [];

  const upcoming = data.records.visits
    .filter(visit => !visit.archived && visit.status === 'Programată')
    .filter(visit => visit.date.slice(0, 7) === data.month)
    .filter(visit => visit.date !== data.selectedDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5);

  const columns: DataTableColumn<Visit>[] = [
    { key: 'date', header: 'Data', sortValue: row => row.date, render: row => formatDate(row.date) },
    { key: 'time', header: 'Ora', sortValue: row => row.time, render: row => row.time },
    {
      key: 'child',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (
        <div>
          <strong>{row.name}</strong>
          {row.birthDate && <small className={styles.dim}> · {formatAge(row.birthDate)}</small>}
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Părinte / telefon',
      render: row => (
        <div>
          <span>{row.parent}</span>
          {row.phone && <small className={styles.dim}> · {row.phone}</small>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
    },
    {
      key: 'group',
      header: 'Grupa dorită',
      render: row => (row.desiredGroupId ? groupNameOf(row.desiredGroupId, data.groups) : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: row => (
        <div className={styles.rowActions} onClick={event => event.stopPropagation()}>
          {data.allowedNextStatuses(row.status).map(status => (
            <button
              key={status}
              type="button"
              className={styles.linkButton}
              onClick={() => void applyQuickStatus(row, status)}
            >
              {status}
            </button>
          ))}
          {row.status === 'Efectuată' && (
            <button type="button" className={styles.linkButtonPrimary} onClick={() => setEnrollTarget(row)}>
              Înscrie copilul
            </button>
          )}
          <button type="button" className={styles.linkButton} onClick={() => setFormTarget(row)}>
            Editează
          </button>
          <button type="button" className={styles.linkButton} onClick={() => void toggleArchived(row)}>
            {row.archived ? 'Dezarhivează' : 'Arhivează'}
          </button>
          <button
            type="button"
            className={styles.linkButton}
            disabled={!row.archived}
            title={row.archived ? undefined : 'Arhivează întâi vizita'}
            onClick={() => void deleteForever(row)}
          >
            Șterge
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.funnelRow}>
        <span className={`${styles.funnelPill} ${styles.funnelYellow}`}>
          <b>{data.funnel.scheduled}</b>
          <span>programate</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelMint}`}>
          <b>{data.funnel.done}</b>
          <span>efectuate</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelOrange}`}>
          <b>{data.funnel.enrolled}</b>
          <span>înscriși</span>
        </span>
        <span className={`${styles.funnelPill} ${styles.funnelPink}`}>
          <b>{data.funnel.withdrew}</b>
          <span>renunțat</span>
        </span>
        <span className={styles.funnelCaption}>ultimele 12 luni</span>
      </div>

      <div className={styles.layoutGrid}>
        <Card className={styles.calendarCard}>
          <div className={styles.calendarToolbar}>
            <strong className={styles.calendarMonth}>{monthLabel(data.month)}</strong>
            <button type="button" className={styles.btnGhost} onClick={data.goToToday}>
              Azi
            </button>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={data.goToPreviousMonth}
              aria-label="Luna anterioară"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={data.goToNextMonth}
              aria-label="Luna următoare"
            >
              ›
            </button>
          </div>

          <div className={styles.calendarGrid}>
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className={styles.calendarHeadCell}>
                {label}
              </div>
            ))}
            {data.weeks.flat().map(day => (
              <button
                key={day.date}
                type="button"
                className={[
                  styles.calendarCell,
                  day.inMonth ? '' : styles.calendarCellOutside,
                  day.isToday ? styles.calendarCellToday : '',
                  data.selectedDate === day.date ? styles.calendarCellSelected : '',
                ].join(' ')}
                onClick={() => data.setSelectedDate(data.selectedDate === day.date ? null : day.date)}
              >
                <strong>{day.day}</strong>
                {day.visits.length > 3 ? (
                  <small className={styles.dim}>{day.visits.length} vizite</small>
                ) : (
                  day.visits.map(visit => (
                    <span
                      key={visit.id}
                      className={`${styles.calendarChip} ${styles[STATUS_CHIP_CLASS[visit.status]]}`}
                    >
                      {visit.time} {visit.name}
                    </span>
                  ))
                )}
              </button>
            ))}
          </div>
        </Card>

        <div className={styles.detailColumn}>
          {!data.selectedDate && (
            <Card className={styles.detailEmpty}>
              <p>Alege o zi din calendar pentru a vedea detaliile vizitelor.</p>
            </Card>
          )}

          {data.selectedDate && selectedDayVisits.length === 0 && (
            <Card className={styles.detailEmpty}>
              <p>Nicio vizită programată în această zi.</p>
              <button type="button" className={styles.btnPrimary} onClick={() => setFormTarget('new')}>
                + Programează vizită
              </button>
            </Card>
          )}

          {selectedDayVisits.map(visit => (
            <Card key={visit.id} className={styles.detailCard}>
              <span className={styles.detailEyebrow}>{dayLabel(visit.date)}</span>
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
                <span>{visit.desiredGroupId ? groupNameOf(visit.desiredGroupId, data.groups) : '—'}</span>
                {visit.notes && (
                  <>
                    <span>Notă</span>
                    <span>{visit.notes}</span>
                  </>
                )}
              </div>

              {(data.allowedNextStatuses(visit.status).length > 0 || visit.status === 'Efectuată') && (
                <>
                  <span className={styles.detailSectionLabel}>Cum a decurs vizita?</span>
                  <div className={styles.quickStatusGrid}>
                    {data.allowedNextStatuses(visit.status).map(status => (
                      <button
                        key={status}
                        type="button"
                        className={`${styles.quickStatus} ${styles[STATUS_PILL_CLASS[status]]}`}
                        onClick={() => void applyQuickStatus(visit, status)}
                      >
                        {status}
                      </button>
                    ))}
                    {visit.status === 'Efectuată' && (
                      <button
                        type="button"
                        className={`${styles.quickStatus} ${styles.pillInscris}`}
                        onClick={() => setEnrollTarget(visit)}
                      >
                        S-a înscris
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className={styles.detailActions}>
                <button type="button" className={styles.detailLink} onClick={() => setFormTarget(visit)}>
                  Editează
                </button>
                <button type="button" className={styles.detailLinkMuted} onClick={() => void toggleArchived(visit)}>
                  {visit.archived ? 'Dezarhivează' : 'Arhivează'}
                </button>
              </div>
            </Card>
          ))}

          <Card className={styles.upcomingCard}>
            <span className={styles.detailSectionLabel}>Următoarele vizite</span>
            {upcoming.length === 0 ? (
              <p className={styles.dim}>Nicio altă vizită programată luna aceasta.</p>
            ) : (
              upcoming.map(visit => (
                <button
                  key={visit.id}
                  type="button"
                  className={styles.upcomingRow}
                  onClick={() => data.setSelectedDate(visit.date)}
                >
                  <span className={styles.upcomingDate}>{formatDate(visit.date)}</span>
                  <span>{visit.name}</span>
                </button>
              ))
            )}
          </Card>
        </div>
      </div>

      <Card className={styles.tableCard}>
        <p className={styles.tableTitle}>Toate vizitele</p>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Caută copil sau părinte…"
            value={data.search}
            onChange={event => data.setSearch(event.target.value)}
            aria-label="Caută vizită"
          />
          <SearchSelect
            className={styles.filterSelect}
            ariaLabel="Filtru statut"
            value={data.statusFilter}
            onChange={data.setStatusFilter}
            options={[
              { value: '', label: 'Toate statuturile' },
              ...(['Programată', 'Efectuată', 'Neprezentată', 'Înscris', 'Renunțat'] as VisitStatus[]).map(
                status => ({ value: status, label: status }),
              ),
            ]}
          />
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={data.allMonths}
              onChange={event => data.setAllMonths(event.target.checked)}
            />
            Toate lunile
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={data.showArchived}
              onChange={event => data.setShowArchived(event.target.checked)}
            />
            Arhivate
          </label>
          {data.selectedDate && (
            <button type="button" className={styles.btnGhost} onClick={() => data.setSelectedDate(null)}>
              {formatDate(data.selectedDate)} ×
            </button>
          )}
        </div>

        <DataTable
          bare
          columns={columns}
          rows={data.rows}
          rowKey={row => row.id}
          emptyState={<p>Nicio vizită nu corespunde filtrelor curente.</p>}
        />
      </Card>

      <VisitFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        groups={data.groups}
        allowedNextStatuses={data.allowedNextStatuses}
        onSubmit={submitVisitForm}
        onClose={() => setFormTarget(null)}
      />
      <EnrollDrawer
        key={enrollTarget === null ? 'closed' : enrollTarget.id}
        visit={enrollTarget}
        groups={data.groups}
        onSubmit={submitEnroll}
        onClose={() => setEnrollTarget(null)}
      />
    </>
  );
}
