import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterPills, MonthStepper, useTopbarActions, useTopbarTitle } from '@shared/ui';
import { pluralRo } from '@shared/format/plural-ro';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useBirthdays, type BirthdaysGroupOption } from './useBirthdays';
import styles from './BirthdaysPage.module.css';

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('ro-RO', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** „Zile de naștere" — rută imbricată sub Copii (/copii/zile-de-nastere), deschisă din butonul de pe
 * Copii sau din „Vezi calendarul →" de pe Dashboard. Aparține modulului Copii, nu Dashboard-ului. */
export function BirthdaysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMonth = isValidMonth(searchParams.get('luna')) ? searchParams.get('luna')! : todayFn().slice(0, 7);
  const data = useBirthdays(initialMonth);

  useTopbarTitle({ title: 'Zile de naștere', eyebrow: 'Evidență · Copii' });
  useTopbarActions(
    <div className={styles.headerActions}>
      <button type="button" className={styles.btnSecondary} onClick={data.goToday}>
        Azi
      </button>
      <MonthStepper value={data.month} onPrev={data.prevMonth} onNext={data.nextMonth} />
    </div>,
  );

  useEffect(() => {
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        next.set('luna', data.month);
        return next;
      },
      { replace: true },
    );
  }, [data.month, setSearchParams]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && /^(input|textarea|select)$/i.test(event.target.tagName)) return;
      if (event.key === 'ArrowLeft') data.prevMonth();
      if (event.key === 'ArrowRight') data.nextMonth();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.prevMonth, data.nextMonth]);

  const toneFor = (groupId: string | null) => groupOf(groupId, data.groups)?.tone ?? 'neutral';
  const groupNameFor = (groupId: string | null) => groupOf(groupId, data.groups)?.name ?? 'Fără grupă';

  return (
    <div className={styles.page}>
      <FilterPills
        groups={[
          {
            label: 'Grupa',
            value: data.group,
            onChange: data.setGroup,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              ...data.groups.map(g => ({ value: g.id, label: g.name, tone: g.tone })),
            ],
          },
        ]}
        trailing={pluralRo(data.count, 'zi de naștere', 'zile de naștere')}
      />
      <div className={styles.body}>
        <section className={styles.calendar} aria-label={`Calendar ${monthLabel(data.month)}`}>
          <div className={styles.weekdays}>
            {WEEKDAY_LABELS.map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {data.status === 'loading' && <p className={styles.notice}>Se încarcă…</p>}
            {data.status !== 'loading' &&
              data.weeks.flat().map(cell => (
                <div
                  key={cell.date}
                  className={cx(
                    styles.cell,
                    !cell.inMonth && styles.outside,
                    cell.isWeekend && styles.weekend,
                    cell.isPast && styles.past,
                    cell.isToday && styles.today,
                  )}
                >
                  {cell.inMonth && <span className={styles.dayNum}>{cell.day}</span>}
                  {cell.entries.slice(0, 2).map(entry => (
                    <Link
                      key={entry.childId}
                      to={`/copii/${entry.childId}`}
                      className={cx(styles.chip, styles[toneFor(entry.groupId)])}
                    >
                      <span className={styles.chipName}>
                        {entry.firstName} {entry.lastInitial}
                      </span>
                      <span className={styles.chipAge}>{entry.turningAge}</span>
                    </Link>
                  ))}
                  {cell.entries.length > 2 && <span className={styles.more}>+{cell.entries.length - 2} copii</span>}
                </div>
              ))}
          </div>
        </section>

        <aside className={styles.side}>
          <h2 className={styles.sideTitle}>Toată luna</h2>
          {data.status === 'loading' && <p className={styles.empty}>Se încarcă…</p>}
          {data.status !== 'loading' && data.list.length === 0 && (
            <p className={styles.empty}>
              {data.group === 'all'
                ? 'Nicio zi de naștere în luna aceasta.'
                : 'Nicio zi de naștere pentru filtrul ales.'}
            </p>
          )}
          {data.list.map(entry => (
            <Link
              key={entry.childId}
              to={`/copii/${entry.childId}`}
              className={cx(styles.item, entry.date < todayFn() && styles.past)}
            >
              <span className={cx(styles.itemDay, styles[toneFor(entry.groupId)])}>{entry.day}</span>
              <span className={styles.itemText}>
                <strong>{entry.name}</strong>
                <small>
                  împlinește {entry.turningAge} {entry.turningAge === 1 ? 'an' : 'ani'} · {groupNameFor(entry.groupId)}
                </small>
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}

function groupOf(groupId: string | null, groups: BirthdaysGroupOption[]): BirthdaysGroupOption | undefined {
  return groupId ? groups.find(g => g.id === groupId) : undefined;
}
