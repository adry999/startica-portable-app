import { Badge, Button, Card, useToast } from '@shared/ui';
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
}: MonthViewProps) {
  const toast = useToast();
  const revenue = children.reduce((sum, row) => sum + row.amount, 0);
  const coachTotal = coaches.reduce((sum, row) => sum + row.amount, 0);

  async function handleClose() {
    if (!window.confirm(`Închizi luna ${month}? Se scriu taxele copiilor și salariile antrenorilor.`)) return;
    try {
      await onCloseMonth();
      toast.show({ message: 'Luna a fost închisă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
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
          <span className={styles.statValue}>{revenue} lei</span>
          <span className={styles.statLabel}>Încasări de luna asta</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{coachTotal} lei</span>
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
                <td>{row.amount} lei</td>
                <td>
                  <Badge tone={row.charged ? 'mint' : 'neutral'}>{row.charged ? 'Taxat' : 'Neînchis'}</Badge>
                </td>
              </tr>
            ))}
            {children.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.empty}>
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
            <p className={styles.coachAmount}>{row.amount} lei</p>
          </Card>
        ))}
      </div>

      <div className={styles.closeRow}>
        <Button disabled={unmarked > 0 || closingBusy} onClick={() => void handleClose()}>
          {closing ? `Închisă la ${new Date(closing.closedAt).toLocaleString('ro-RO')}` : 'Închide luna'}
        </Button>
        {unmarked > 0 && <p className={styles.notice}>{unmarked} ședințe nemarcate — consemnează-le mai întâi.</p>}
        {closeError && <p className={styles.error}>{closeError}</p>}
      </div>
    </>
  );
}
