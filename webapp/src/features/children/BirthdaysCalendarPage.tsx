import { useNavigate } from 'react-router-dom';
import { Card } from '@shared/ui';
import { useBirthdaysCalendar } from './useBirthdaysCalendar';
import styles from './BirthdaysCalendarPage.module.css';

const WEEKDAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('ro-RO', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface BirthdaysCalendarPageProps {
  /** Presetează luna afișată — venit din ?luna= (link „Vezi calendarul" de pe Dashboard). */
  initialMonth?: string;
}

/** Pagina „Zile de naștere" (2a din Dashboard.dc.html) — rută imbricată sub Copii (/copii/zile-de-nastere),
 * deschisă din cardul compact al Dashboard-ului, dar aparține modulului Copii, nu Dashboard-ului. */
export function BirthdaysCalendarPage({ initialMonth }: BirthdaysCalendarPageProps) {
  const data = useBirthdaysCalendar(initialMonth);
  const navigate = useNavigate();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  return (
    <>
      <p className={styles.breadcrumb}>
        <button type="button" onClick={() => navigate('/copii')}>
          Copii
        </button>{' '}
        / Zile de naștere
      </p>

      <div className={styles.pageHead}>
        <h2 className={styles.pageTitle}>Zile de naștere</h2>
        <span className={styles.pageCount}>
          {data.monthList.length} {data.monthList.length === 1 ? 'zi de naștere' : 'zile de naștere'}
        </span>
      </div>

      {data.groups.length > 0 && (
        <div className={styles.groupFilters}>
          <span className={styles.groupFiltersLabel}>Grupă</span>
          <button
            type="button"
            className={data.groupFilter === '' ? styles.chipActive : styles.chip}
            onClick={() => data.setGroupFilter('')}
          >
            Toate
          </button>
          {data.groups.map(group => (
            <button
              key={group.id}
              type="button"
              className={data.groupFilter === group.id ? styles.chipActive : styles.chip}
              onClick={() => data.setGroupFilter(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

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
              <div
                key={day.date}
                className={[
                  styles.calendarCell,
                  day.inMonth ? '' : styles.calendarCellOutside,
                  day.isToday ? styles.calendarCellToday : '',
                ].join(' ')}
              >
                <strong>{day.day}</strong>
                {day.names.map(entry => (
                  <span key={entry.name} className={styles.calendarChip}>
                    {entry.name} · {entry.turningAge} {entry.turningAge === 1 ? 'an' : 'ani'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card className={styles.monthListCard}>
          <p className={styles.monthListTitle}>Toată luna</p>
          {data.monthList.length === 0 && <p className={styles.notice}>Nicio zi de naștere în luna aceasta.</p>}
          <div className={styles.monthList}>
            {data.monthList.map(entry => (
              <div key={`${entry.date}-${entry.name}`} className={styles.monthListRow}>
                <span className={styles.monthListDay}>{entry.day}</span>
                <div>
                  <strong>{entry.name}</strong>
                  <small>
                    împlinește {entry.turningAge} {entry.turningAge === 1 ? 'an' : 'ani'}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
