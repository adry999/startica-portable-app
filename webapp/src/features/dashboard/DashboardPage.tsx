import { useState } from 'react';
import { Card, SegmentedControl } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useDashboard, type AttentionItem, type AttentionTone } from './useDashboard';
import type { ViewKey } from '../../app/shell/nav-items';
import styles from './DashboardPage.module.css';

const AVATAR_TONE_CLASS = [styles.avatarOrange, styles.avatarMint, styles.avatarPink];
const MONTH_NAMES = [
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

const METHOD_LABELS: Record<string, string> = { Cash: 'Cash', Card: 'Card', Transfer: 'Transfer' };
const METHOD_BAR_CLASS: Record<string, string> = {
  Cash: styles.methodCash,
  Card: styles.methodCard,
  Transfer: styles.methodTransfer,
};
const METHOD_DOT_CLASS: Record<string, string> = {
  Cash: styles.legendDotCash,
  Card: styles.legendDotCard,
  Transfer: styles.legendDotTransfer,
};
const ATTENTION_TONE_CLASS: Record<AttentionTone, string> = {
  urgent: styles.tonePink,
  review: styles.toneYellow,
  assign: styles.toneMint,
  visits: styles.toneYellow,
};

const formatCompactMoney = (value: number) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value);

function fullMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-');
  const name = MONTH_NAMES[Number(monthIndex) - 1] ?? monthIndex;
  return `${name} ${year}`;
}

export interface DashboardPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
}

const CHART_MODE_OPTIONS = [
  { value: 'income' as const, label: 'Încasări' },
  { value: 'expense' as const, label: 'Cheltuieli' },
];

export function DashboardPage({ month, onNavigate }: DashboardPageProps) {
  const data = useDashboard(month);
  const [chartMode, setChartMode] = useState<'income' | 'expense'>('income');
  const [activeBar, setActiveBar] = useState<string | null>(null);

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const currentMonthIndex = data.revenueHistory.length - 1;
  const revenueView = chartMode === 'expense' ? data.expenseHistory : data.revenueHistory;
  const maxRevenue = Math.max(1, ...revenueView.map(r => r.value));

  return (
    <>
      <div className={styles.kpiRow}>
        <Card tone="orange" decorative="lg" className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelIncome}`}>Încasări</p>
          <strong className={styles.kpiValue}>{formatMoney(data.income)}</strong>
          <div className={styles.methodBar}>
            {Object.entries(data.byMethod)
              .filter(([method, value]) => METHOD_BAR_CLASS[method] && value > 0)
              .map(([method, value]) => (
                <span
                  key={method}
                  className={METHOD_BAR_CLASS[method]}
                  style={{ width: `${(value / Math.max(1, data.income)) * 100}%` }}
                />
              ))}
          </div>
          <div className={styles.methodLegend}>
            {Object.entries(data.byMethod)
              .filter(([method, value]) => METHOD_LABELS[method] && value > 0)
              .map(([method, value]) => (
                <span key={method} className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${METHOD_DOT_CLASS[method]}`} />
                  {METHOD_LABELS[method]} {formatCompactMoney(value)}
                </span>
              ))}
          </div>
        </Card>

        <Card tone="mint" decorative className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelExpense}`}>Cheltuieli</p>
          <strong className={styles.kpiValue}>{formatMoney(data.expense)}</strong>
          <button type="button" className={styles.mintLink} onClick={() => onNavigate('expenses')}>
            + Adaugă cheltuială
          </button>
        </Card>

        <Card tone="yellow" decorative className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelNet}`}>Diferență</p>
          <strong className={styles.kpiValue}>{formatMoney(data.net)}</strong>
          <small className={styles.netHint}>încasări − cheltuieli</small>
        </Card>

        <Card tone="dashed" className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelAdvance}`}>Avansuri nerepartizate</p>
          <strong className={styles.kpiValue}>{formatMoney(data.advance)}</strong>
          <span className={styles.pillNeutral}>Toate lunile, până azi</span>
        </Card>
      </div>

      <div className={styles.row2}>
        <Card className={styles.revenuePanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelTitle}>Evoluția încasărilor</p>
              <p className={styles.panelSubtitle}>Ultimele 12 luni</p>
            </div>
            <SegmentedControl
              ariaLabel="Evoluția încasărilor sau cheltuielilor"
              options={CHART_MODE_OPTIONS}
              value={chartMode}
              onChange={setChartMode}
            />
          </div>
          <div className={styles.bars}>
            {revenueView.map((bar, index) => {
              const isActive = activeBar === bar.month;
              const methodEntries = Object.entries(bar.byMethod ?? {}).filter(([, value]) => value > 0);
              return (
                <div key={bar.month} className={styles.barColumn}>
                  {isActive && (
                    <div className={styles.barTooltip} role="tooltip">
                      <strong>{fullMonthLabel(bar.month)}</strong>
                      <span>{formatMoney(bar.value)}</span>
                      {methodEntries.length > 0 && (
                        <ul className={styles.barTooltipMethods}>
                          {methodEntries.map(([method, value]) => (
                            <li key={method}>
                              {METHOD_LABELS[method] ?? method}: {formatCompactMoney(value)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`${styles.barButton} ${
                      index === currentMonthIndex
                        ? styles.barCurrent
                        : bar.value === 0
                          ? styles.barEmpty
                          : styles.barPast
                    } ${isActive ? styles.barActive : ''}`}
                    style={{ height: bar.value === 0 ? 6 : Math.max(6, (bar.value / maxRevenue) * 100) }}
                    onMouseEnter={() => setActiveBar(bar.month)}
                    onMouseLeave={() => setActiveBar(current => (current === bar.month ? null : current))}
                    onFocus={() => setActiveBar(bar.month)}
                    onBlur={() => setActiveBar(current => (current === bar.month ? null : current))}
                    aria-label={`${fullMonthLabel(bar.month)}: ${formatMoney(bar.value)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.barLabels}>
            {revenueView.map((bar, index) => (
              <small key={bar.month} className={index === currentMonthIndex ? styles.barLabelCurrent : undefined}>
                {bar.month.slice(5)}
              </small>
            ))}
          </div>
        </Card>

        <Card className={styles.attentionPanel}>
          <div>
            <p className={styles.panelEyebrow}>Necesită atenție</p>
            <p className={styles.panelTitle}>Rezolvă pentru date corecte</p>
          </div>
          {data.allClear ? (
            <div className={styles.attentionEmpty}>
              <strong>Nicio acțiune în listele urmărite.</strong>
              <span>
                {data.hasAnyRecords
                  ? 'Nu există notificări, înregistrări de verificat sau achitări neasociate.'
                  : 'Nu sunt copii sau achitări înregistrate încă.'}
              </span>
            </div>
          ) : (
            <div className={styles.attentionList}>
              {data.attentionItems.map(item => (
                <AttentionRow key={item.title} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className={styles.birthdaysCard}>
        <div className={styles.birthdaysGrid}>
          <div className={styles.birthdaysUpcoming}>
            <div>
              <p className={styles.panelEyebrowMint}>Zile de naștere</p>
              <p className={styles.panelTitle}>În următoarele 5 zile</p>
            </div>
            {data.upcomingBirthdays.length === 0 && (
              <p className={styles.notice}>Nicio zi de naștere în următoarele 5 zile.</p>
            )}
            {data.upcomingBirthdays.map(
              (row: { child: { id: string; name: string }; daysUntil: number; turningAge: number }, index: number) => (
                <div key={row.child.id} className={styles.birthdayRow}>
                  <span className={`${styles.avatar} ${AVATAR_TONE_CLASS[index % AVATAR_TONE_CLASS.length]}`}>
                    {initials(row.child.name)}
                  </span>
                  <div>
                    <strong>{row.child.name}</strong>
                    <small>
                      împlinește {row.turningAge} {row.turningAge === 1 ? 'an' : 'ani'}
                    </small>
                  </div>
                  <span className={styles.birthdayPill}>
                    {row.daysUntil === 0 ? 'azi' : row.daysUntil === 1 ? 'mâine' : `în ${row.daysUntil} zile`}
                  </span>
                </div>
              ),
            )}
          </div>
          <div className={styles.birthdaysMonth}>
            <div className={styles.birthdaysMonthHead}>
              <strong>Toată luna {MONTH_NAMES[Number(month.slice(5, 7)) - 1]}</strong>
            </div>
            <div className={styles.birthdaysCalendar}>
              {data.birthdayWeeks
                .flat()
                .filter((cell: { inMonth: boolean; names: unknown[] }) => cell.inMonth && cell.names.length > 0)
                .map(cell => {
                  const upcoming = cell.date >= todayFn();
                  return (
                    <div key={cell.date} className={upcoming ? styles.calendarCellUpcoming : styles.calendarCellPast}>
                      <strong>{cell.day}</strong>
                      <span>{cell.names.map((n: { name: string }) => n.name).join(', ')}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function AttentionRow({ item, onNavigate }: { item: AttentionItem; onNavigate: (view: ViewKey) => void }) {
  const clear = item.count === 0 && !item.forceShow;
  return (
    <article className={`${styles.attentionRow} ${clear ? styles.attentionRowClear : ATTENTION_TONE_CLASS[item.tone]}`}>
      <span className={styles.attentionCount}>{item.count}</span>
      <div className={styles.attentionText}>
        <strong>{item.title}</strong>
        <small>{clear ? 'Nicio acțiune necesară pe această listă.' : item.detail}</small>
      </div>
      <button type="button" className={styles.attentionAction} onClick={() => onNavigate(item.view as ViewKey)}>
        {clear ? 'Vezi lista' : item.action} →
      </button>
    </article>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}
