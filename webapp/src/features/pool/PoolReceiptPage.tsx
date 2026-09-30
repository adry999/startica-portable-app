import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useKindergarten } from '@shared/api/useKindergarten';
import { usePoolMonth, usePoolSettings } from '@shared/pool/usePool';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatMonthName } from '#shared/format/date-format.mjs';
import { expandBooking } from '#features/pool/index.web.mjs';
import { today } from '@domain/calendar-month.mjs';
import { PoolReceiptLabel, type PoolSessionCell } from './PoolReceiptLabel';
import styles from './PoolReceiptPage.module.css';

const WEEKDAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri'];
const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** Bonul 58 mm al Bazinului (24c, Bazin spec 23) — ruta reală peste `PoolReceiptLabel`. */
export function PoolReceiptPage() {
  const { childId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const month = searchParams.get('month') || today().slice(0, 7);

  const session = useAppSession();
  const monthData = usePoolMonth(month);
  const poolSettings = usePoolSettings();
  const kindergarten = useKindergarten();

  if (monthData.loading || poolSettings.loading) return <p>Se încarcă bonul…</p>;

  const row = monthData.children.find(item => item.childId === childId);
  if (!row) {
    return (
      <>
        <Button variant="outline" onClick={() => navigate('/bazin')}>
          ← Bazin
        </Button>
        <p>Copilul nu are programări la bazin în luna asta.</p>
      </>
    );
  }

  const booking = row.bookings[0] ?? null;
  const coachRow = booking ? (monthData.coaches.find(item => item.coachId === booking.coachId) ?? null) : null;
  const child = session.state.state.children.find(item => item.id === childId) ?? row.child;
  const groupName = child?.groupId ? groupNameOf(child.groupId, session.state.state.groups) : '';

  const sessionByDate = new Map(row.sessions.map(entry => [entry.date, entry]));
  const dates = booking ? expandBooking(booking, month) : [];
  const sessions: PoolSessionCell[] = dates.map(date => {
    const [, monthNum, day] = date.split('-');
    return {
      day: String(Number(day)),
      monthLabel: MONTHS_SHORT[Number(monthNum) - 1] ?? monthNum,
      dashed: sessionByDate.get(date)?.status === 'cancelled',
    };
  });

  const monthTitle = `BAZIN · ${formatMonthName(month).split(' ')[0].toUpperCase()}`;
  const weekdayTime = booking ? `${WEEKDAYS[booking.weekday - 1] ?? ''} · ${booking.time}` : '—';
  const pricePerSession = poolSettings.settings?.pricePerSession ?? poolSettings.seed?.pricePerSession ?? 0;
  const itemsNote = poolSettings.settings?.itemsNote ?? poolSettings.seed?.itemsNote ?? '';

  return (
    <div className={styles.page}>
      <style>{'@page { size: 58mm auto; margin: 0; }'}</style>
      <div className={styles.toolbar}>
        <Button variant="white" onClick={() => navigate(-1)}>
          ← Înapoi
        </Button>
        <Button onClick={() => window.print()}>Tipărește</Button>
      </div>
      <PoolReceiptLabel
        childName={child?.name ?? row.childId}
        groupName={groupName}
        coachName={coachRow?.coach?.name ?? ''}
        monthTitle={monthTitle}
        weekdayTime={weekdayTime}
        sessions={sessions}
        pricePerSession={pricePerSession}
        itemsNote={itemsNote}
        logoDataUrl={kindergarten.settings?.logoDataUrl}
      />
    </div>
  );
}
