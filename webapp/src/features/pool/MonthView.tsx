import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDeleteDialog, Drawer, RowMenu, useToast } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { endBooking } from '@shared/pool/usePool';
import type { ChildMonthRow, CoachMonthRow } from '@shared/pool/usePool';
import styles from './MonthView.module.css';

export interface MonthViewProps {
  month: string;
  children: ChildMonthRow[];
  coaches: CoachMonthRow[];
  closing: { month: string; closedAt: string } | null;
  unmarked: number;
  closingBusy: boolean;
  closeError: string;
  onCloseMonth: () => Promise<void>;
  /** Reîncarcă luna după ce o programare a fost oprită (A-3) — aceeași sursă ca după „Programare nouă”. */
  onReload: () => void;
}

/** Luna Bazinului (22c): situația fiecărui copil, plata fiecărui antrenor, „Închide luna”. */
export function MonthView({
  month,
  children,
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
          <span className={styles.statValue}>{children.length}</span>
          <span className={styles.statLabel}>Copii cu programări</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{formatMoney(revenue)}</span>
          <span className={styles.statLabel}>Încasări de luna asta</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{formatMoney(coachTotal)}</span>
          <span className={styles.statLabel}>Salarii antrenori</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{unmarked}</span>
          <span className={styles.statLabel}>Ședințe nemarcate</span>
        </Card>
      </div>

      <Card className={styles.table}>
        <table>
          <thead>
            <tr>
              <th>Copil</th>
              <th>Programate</th>
              <th>Prezenți</th>
              <th>Absenți</th>
              <th>Motivat</th>
              <th>Sumă</th>
              <th>Stare</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {children.map(row => (
              <tr key={row.childId}>
                <td>{row.child?.name ?? row.childId}</td>
                <td>{row.scheduled}</td>
                <td>{row.present}</td>
                <td>{row.absent}</td>
                <td>{row.excused}</td>
                <td>{formatMoney(row.amount)}</td>
                <td>
                  <Badge tone={row.charged ? 'mint' : 'neutral'}>{row.charged ? 'Taxat' : 'Neînchis'}</Badge>
                </td>
                <td>
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
                </td>
              </tr>
            ))}
            {children.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  Nicio programare în luna asta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className={styles.coaches}>
        {coaches.map(row => (
          <Card key={row.coachId} className={styles.coachCard}>
            <h4>{row.coach?.name ?? row.coachId}</h4>
            <p>
              {row.sessionsHeld} ședințe · {row.childrenPresent} copii prezenți
            </p>
            <p className={styles.coachAmount}>{formatMoney(row.amount)}</p>
          </Card>
        ))}
      </div>

      <div className={styles.closeRow}>
        <Button disabled={unmarked > 0 || closingBusy} onClick={() => setCloseConfirmOpen(true)}>
          {closing ? `Închisă la ${new Date(closing.closedAt).toLocaleString('ro-RO')}` : 'Închide luna'}
        </Button>
        {unmarked > 0 && <p className={styles.notice}>{unmarked} ședințe nemarcate — consemnează-le mai întâi.</p>}
        {closeError && <p className={styles.error}>{closeError}</p>}
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
