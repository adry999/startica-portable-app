import {
  Badge,
  Button,
  Card,
  EMPTY_STATES,
  EmptyState,
  resolveEmptyStateText,
  resolveEmptyStateTitle,
} from '@shared/ui';
import type { TodaySession } from './today-sessions';
import styles from './TodayView.module.css';

export interface TodayViewProps {
  status: 'loading' | 'ready';
  /** Ex. „Bazin · joi, 2 octombrie” (43b, antetul cardului). */
  dateLabel: string;
  sessions: TodaySession[];
  onMark: (session: TodaySession) => void;
}

function sessionBadge(session: TodaySession): { tone: 'mint' | 'yellow' | 'orange'; label: string } {
  if (session.unmarkedCount === 0) return { tone: 'mint', label: 'Toate marcate' };
  if (session.unmarkedCount === session.childCount) return { tone: 'orange', label: 'De marcat' };
  return { tone: 'yellow', label: `${session.childCount - session.unmarkedCount}/${session.childCount} marcate` };
}

/**
 * 43b — pagina „Azi” a Bazinului: ședințele zilei, cea în curs evidențiată, „Marchează” deschide
 * prezența pe acea ședință. Fără bani/abonamente pe acest ecran (notă din artboard). Datele vin
 * deja calculate de apelant (`today-sessions.ts`, peste `usePoolWeek` — nicio cerere nouă).
 */
export function TodayView({ status, dateLabel, sessions, onMark }: TodayViewProps) {
  const totalChildren = sessions.reduce((sum, session) => sum + session.childCount, 0);

  if (status === 'loading') {
    return (
      <Card tone="white" className={styles.root}>
        <div className={styles.loading} role="status" aria-label="Se încarcă…">
          {[0, 1, 2].map(index => (
            <span key={index} className={styles.loadingRow} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card tone="white" className={styles.root}>
      <div className={styles.header}>
        <b className={styles.title}>{dateLabel}</b>
        <span className={styles.subtitle}>
          {sessions.length} {sessions.length === 1 ? 'ședință' : 'ședințe'} · {totalChildren}{' '}
          {totalChildren === 1 ? 'copil' : 'copii'}
        </span>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          variant="period"
          title={resolveEmptyStateTitle(EMPTY_STATES['bazin.today.period'])}
          description={resolveEmptyStateText(EMPTY_STATES['bazin.today.period'])}
        />
      ) : (
        <div className={styles.list}>
          {sessions.map(session => {
            const badge = sessionBadge(session);
            return (
              <div key={session.time} className={session.isCurrent ? `${styles.row} ${styles.current}` : styles.row}>
                <b className={styles.time}>{session.time}</b>
                <div className={styles.sessionInfo}>
                  <b className={styles.coach}>{session.coachLabel}</b>
                  <span className={styles.count}>
                    {session.childCount} {session.childCount === 1 ? 'copil' : 'copii'}
                  </span>
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <Button size="header" onClick={() => onMark(session)}>
                  Marchează
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.note}>
        Ședința în curs e evidențiată. „Marchează” deschide prezența la bazin pe ședința respectivă. Fără plăți și
        abonamente pe acest profil; doar cine vine și cine a lipsit.
      </p>
    </Card>
  );
}
