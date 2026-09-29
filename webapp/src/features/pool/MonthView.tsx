import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDeleteDialog, Drawer, RowMenu, useToast, groupTone } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { initials } from '@shared/format/initials';
import { today } from '@domain/calendar-month.mjs';
import { endBooking } from '@shared/pool/usePool';
import type { ChildMonthRow, CoachMonthRow } from '@shared/pool/usePool';
import type { Group } from '@contracts/record-types.mjs';
import styles from './MonthView.module.css';

export interface MonthViewProps {
  month: string;
  children: ChildMonthRow[];
  groups?: Group[];
  coaches: CoachMonthRow[];
  closing: { month: string; closedAt: string } | null;
  unmarked: number;
  closingBusy: boolean;
  closeError: string;
  onCloseMonth: () => Promise<void>;
  /** Reîncarcă luna după ce o programare a fost oprită (A-3) — aceeași sursă ca după „Programare nouă”. */
  onReload: () => void;
}

const MONTH_NAMES_LOWER = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

/** Luna Bazinului (22c): situația fiecărui copil, plata fiecărui antrenor, „Închide luna”. */
export function MonthView({
  month,
  children,
  groups = [],
  coaches,
  closing,
  unmarked,
  closingBusy,
  closeError,
  onCloseMonth,
  onReload,
}: MonthViewProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [endingRow, setEndingRow] = useState<ChildMonthRow | null>(null);
  const [endDate, setEndDate] = useState(today());
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState('');
  const revenue = children.reduce((sum, row) => sum + row.amount, 0);
  const coachTotal = coaches.reduce((sum, row) => sum + row.amount, 0);
  const monthLabel = MONTH_NAMES_LOWER[Number(month.slice(5, 7)) - 1] ?? '';

  async function handleClose() {
    setCloseConfirmOpen(false);
    try {
      await onCloseMonth();
      toast.show({ message: 'Luna a fost închisă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function openEndBooking(row: ChildMonthRow) {
    setEndingRow(row);
    setEndDate(today());
    setEndError('');
  }

  async function confirmEndBooking() {
    const booking = endingRow?.bookings.find(candidate => !candidate.archivedAt) ?? endingRow?.bookings[0];
    if (!booking) return;
    setEndBusy(true);
    setEndError('');
    try {
      await endBooking(booking.id, endDate);
      toast.show({ message: 'Programarea a fost oprită.' });
      setEndingRow(null);
      onReload();
    } catch (error) {
      setEndError((error as Error).message);
    } finally {
      setEndBusy(false);
    }
  }

  return (
    <>
      <div className={styles.cards}>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Copii cu programări</span>
          <span className={styles.statValue}>{children.length}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Încasări de luna asta</span>
          <span className={styles.statValue}>{formatMoney(revenue)}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Salarii antrenori</span>
          <span className={styles.statValue}>{formatMoney(coachTotal)}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Ședințe nemarcate</span>
          <span className={styles.statValue}>{unmarked}</span>
        </Card>
      </div>

      <div className={styles.mainGrid}>
        <Card className={styles.tableCard}>
          <div className={styles.tableToolbar}>
            <span className={styles.tableTitle}>Pe copii</span>
          </div>
          <div className={styles.tableHead}>
            <span>Copil</span>
            <span className={styles.center}>Progr.</span>
            <span className={styles.center}>Venit</span>
            <span className={styles.center}>Lipsă</span>
            <span className={styles.center}>Motiv.</span>
            <span className={styles.right}>De încasat</span>
            <span>Plată</span>
            <span></span>
          </div>
          {children.map(row => {
            const tone = groupTone(row.child?.groupId ?? null, groups);
            return (
            <div className={styles.tableRow} key={row.childId}>
              <div className={styles.childCell}>
                <span
                  className={styles.childAvatar}
                  style={{ background: `var(--${tone}-soft, var(--neutral-soft))`, color: `var(--${tone}-ink, var(--subtle))` }}
                >
                  {initials(row.child?.name ?? row.childId)}
                </span>
                <span className={styles.childName}>{row.child?.name ?? row.childId}</span>
              </div>
              <span className={styles.center}>{row.scheduled}</span>
              <span className={`${styles.center} ${styles.present}`}>{row.present}</span>
              <span className={`${styles.center} ${styles.absent}`}>{row.absent}</span>
              <span className={`${styles.center} ${styles.excused}`}>{row.excused}</span>
              <span className={`${styles.right} ${styles.amount}`}>{formatMoney(row.amount)}</span>
              <span>
                <Badge tone={row.charged ? 'mint' : 'neutral'}>{row.charged ? 'Taxat' : 'Neînchis'}</Badge>
              </span>
              <span className={styles.rowActions}>
                <RowMenu
                  items={[
                    { label: 'Bon 58 mm', onClick: () => navigate(`/bazin/bon/${row.childId}?month=${month}`) },
                    {
                      label: 'Oprește programarea',
                      onClick: () => openEndBooking(row),
                      disabled: row.bookings.length === 0,
                    },
                  ]}
                />
              </span>
            </div>
            );
          })}
          {children.length === 0 && <div className={styles.empty}>Nicio programare în luna asta.</div>}
        </Card>

        <div className={styles.side}>
          {coaches.map(row => (
            <Card key={row.coachId} className={styles.coachCard}>
              <div className={styles.coachHead}>
                <span className={styles.coachAvatar}>{initials(row.coach?.name ?? row.coachId)}</span>
                <div className={styles.coachHeadText}>
                  <strong>{row.coach?.name ?? row.coachId}</strong>
                  <span className={styles.coachRole}>
                    Antrenor · {formatMoney(row.rate)} pe {row.mode === 'per_child' ? 'copil prezent' : 'ședință ținută'}
                  </span>
                </div>
              </div>
              <div className={styles.coachStats}>
                <span>Ședințe ținute</span>
                <span className={styles.coachStatValue}>{row.sessionsHeld}</span>
                <span>Copii veniți</span>
                <span className={styles.coachStatValue}>{row.childrenPresent}</span>
                <span>Tarif</span>
                <span className={styles.coachStatValue}>× {formatMoney(row.rate)}</span>
              </div>
              <div className={styles.coachSalary}>
                <span>Salariu {monthLabel}</span>
                <span className={styles.coachAmount}>{formatMoney(row.amount)}</span>
              </div>
              <p className={styles.coachNote}>
                Lipsele și motivările nu intră în salariu. La „Închide luna”, salariul se adaugă automat în
                Cheltuieli, categoria Salarii.
              </p>
            </Card>
          ))}

          <div className={styles.infoCard}>
            <b>Cum se încasează.</b> Suma de bazin se adaugă la obligația lunii copilului, ca rând separat „Bazin” în
            Situația plăților. Nu se face o achitare separată.
          </div>

          <div className={styles.closeRow}>
            <Button disabled={unmarked > 0 || closingBusy} onClick={() => setCloseConfirmOpen(true)}>
              {closing ? `Închisă la ${new Date(closing.closedAt).toLocaleString('ro-RO')}` : 'Închide luna'}
            </Button>
            {unmarked > 0 && <p className={styles.notice}>{unmarked} ședințe nemarcate — consemnează-le mai întâi.</p>}
            {closeError && <p className={styles.error}>{closeError}</p>}
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={closeConfirmOpen}
        title={`Închizi luna ${month}?`}
        description="Se scriu taxele copiilor și salariile antrenorilor."
        confirmWord="ÎNCHIDE"
        onConfirm={() => void handleClose()}
        onCancel={() => setCloseConfirmOpen(false)}
      />

      <Drawer
        open={!!endingRow}
        title={`Oprește programarea — ${endingRow?.child?.name ?? endingRow?.childId ?? ''}`}
        width={420}
        onClose={() => setEndingRow(null)}
        footer={
          <Button disabled={endBusy} onClick={() => void confirmEndBooking()}>
            Salvează
          </Button>
        }
      >
        <div className={styles.endForm}>
          <label className={styles.field}>
            Ultima zi
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </label>
          {endError && <p className={styles.error}>{endError}</p>}
        </div>
      </Drawer>
    </>
  );
}
