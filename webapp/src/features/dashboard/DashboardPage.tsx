import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Button,
  Card,
  EMPTY_STATES,
  EmptyState,
  Legend,
  LoadingState,
  ProgressBar,
  resolveEmptyStateTitle,
  type LegendTone,
  type ProgressBarTone,
} from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { capitalize, formatMonthAbbrev, formatShortDayMonth } from '#shared/format/date-format.mjs';
import { initials } from '@shared/format/initials';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useDashboard, type AttentionItem, type AttentionTone } from './useDashboard';
import type { ViewKey } from '@shared/view-key';
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
const METHOD_TONE: Record<string, ProgressBarTone & LegendTone> = { Cash: 'orange', Card: 'yellow', Transfer: 'mint' };
// F24 (PROMPT-11 §12): 3 tonuri — roz (bani), galben (date și prezență), gri (sistem).
const ATTENTION_TONE_CLASS: Record<AttentionTone, string> = {
  bani: styles.tonePink,
  date: styles.toneYellow,
  sistem: styles.toneGray,
};

const formatCompactMoney = (value: number) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value);

// KPI-urile Dashboard-ului vor sume fără zecimale (08-dashboard.md #4), spre deosebire de
// formatMoney folosit peste tot altundeva — nu schimbăm formatMoney global pentru un singur ecran.
const formatKpiMoney = (value: number) => `${formatCompactMoney(value)} lei`;

function fullMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-');
  const name = MONTH_NAMES[Number(monthIndex) - 1] ?? monthIndex;
  return `${name} ${year}`;
}

export interface DashboardPageProps {
  month: string;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

export function DashboardPage({ month, onNavigate }: DashboardPageProps) {
  const dashboardData = useDashboard(month);
  const navigate = useNavigate();

  if (dashboardData.status === 'loading') return <LoadingState />;
  if (dashboardData.status === 'failed')
    return <p className={styles.notice}>{dashboardData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const currentMonthIndex = dashboardData.revenueHistory.length - 1;
  // Aceeași scală pentru Încasări și Cheltuieli (A8) — o singură coloană cu ambele serii pe lună.
  const chartMonths = dashboardData.revenueHistory.map((bar, index) => ({
    month: bar.month,
    income: bar.value,
    expense: dashboardData.expenseHistory[index]?.value ?? 0,
  }));
  const hasRevenueData = chartMonths.some(bar => bar.income > 0 || bar.expense > 0);
  const monthBirthdayCells = dashboardData.birthdayWeeks
    .flat()
    .filter((cell: { inMonth: boolean; names: unknown[] }) => cell.inMonth && cell.names.length > 0);

  return (
    <>
      <div className={styles.kpiRow}>
        <Card tone="orange" decorative="lg" className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelIncome}`}>Încasări</p>
          <strong className={styles.kpiValue}>{formatKpiMoney(dashboardData.income)}</strong>
          <ProgressBar
            variant="segmented"
            className={styles.methodBar}
            segments={Object.entries(dashboardData.byMethod)
              .filter(([method, value]) => METHOD_TONE[method] && value > 0)
              .map(([method, value]) => ({
                tone: METHOD_TONE[method],
                value: (value / Math.max(1, dashboardData.income)) * 100,
              }))}
          />
          <Legend
            className={styles.methodLegend}
            items={Object.entries(dashboardData.byMethod)
              .filter(([method, value]) => METHOD_LABELS[method] && value > 0)
              .map(([method, value]) => ({
                tone: METHOD_TONE[method],
                label: `${METHOD_LABELS[method]} ${formatCompactMoney(value)}`,
              }))}
          />
        </Card>

        <Card tone="mint" decorative className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelExpense}`}>Cheltuieli</p>
          <strong className={`${styles.kpiValue} ${styles.kpiValueSm}`}>{formatKpiMoney(dashboardData.expense)}</strong>
          <Button variant="link" className={styles.mintLink} onClick={() => onNavigate('expenses', { nou: '1' })}>
            + Adaugă cheltuială
          </Button>
        </Card>

        <Card tone="yellow" decorative className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelNet}`}>Diferență</p>
          <strong className={`${styles.kpiValue} ${styles.kpiValueSm}`}>{formatKpiMoney(dashboardData.net)}</strong>
          <small className={styles.netHint}>încasări − cheltuieli</small>
        </Card>

        <Card tone="dashed" className={styles.kpiCard}>
          <p className={`${styles.kpiLabel} ${styles.kpiLabelAdvance}`}>Avansuri nerepartizate</p>
          <strong className={`${styles.kpiValue} ${styles.kpiValueSm}`}>{formatKpiMoney(dashboardData.advance)}</strong>
          <span className={styles.pillNeutral}>Toate lunile, până azi</span>
        </Card>
      </div>

      <div className={styles.row2}>
        <Card className={styles.revenuePanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelTitle}>Evoluția încasărilor</p>
              <p className={styles.panelSubtitle}>
                {chartMonths.length >= 12
                  ? 'Ultimele 12 luni'
                  : `Din ${fullMonthLabel(chartMonths[0]?.month ?? month)}`}
              </p>
            </div>
            <Legend
              className={styles.chartLegend}
              items={[
                { tone: 'orange', label: 'Încasări' },
                { tone: 'mint', label: 'Cheltuieli' },
              ]}
            />
          </div>
          {hasRevenueData ? (
            <BarChart
              ariaLabel={`Evoluția încasărilor și cheltuielilor, ${chartMonths.length >= 12 ? 'ultimele 12 luni' : `din ${fullMonthLabel(chartMonths[0]?.month ?? month)}`}`}
              showScale
              currentLabelHint="în curs"
              series={chartMonths.map((bar, index) => ({
                label: formatMonthAbbrev(bar.month),
                value: bar.income,
                current: index === currentMonthIndex,
              }))}
              secondarySeries={chartMonths.map((bar, index) => ({
                label: formatMonthAbbrev(bar.month),
                value: bar.expense,
                current: index === currentMonthIndex,
              }))}
              grouped
              groupAriaLabel={(_item, _secondary, index) => {
                const bar = chartMonths[index];
                return `${fullMonthLabel(bar.month)}: încasări ${formatMoney(bar.income)}, cheltuieli ${formatMoney(bar.expense)}`;
              }}
              groupTooltip={(_item, _secondary, index) => {
                const bar = chartMonths[index];
                const diff = bar.income - bar.expense;
                return `${capitalize(fullMonthLabel(bar.month))} · încasări ${formatCompactMoney(bar.income)} lei · cheltuieli ${formatCompactMoney(bar.expense)} lei · diferență ${formatCompactMoney(diff)} lei`;
              }}
            />
          ) : null}
          {hasRevenueData && (
            <p className={styles.chartCaption}>
              Începe din prima lună cu date ({fullMonthLabel(chartMonths[0]?.month ?? month)}), maxim 12 luni. Peste
              bare: încasările lunii. Hover: încasări, cheltuieli, diferență.
            </p>
          )}
          {!hasRevenueData && (
            <EmptyState
              variant={EMPTY_STATES['dashboard.revenue.first'].variant}
              size="compact"
              title={resolveEmptyStateTitle(EMPTY_STATES['dashboard.revenue.first'])}
            />
          )}
        </Card>

        <Card className={styles.attentionPanel}>
          <div>
            <p className={styles.panelEyebrow}>Necesită atenție</p>
            <p className={styles.panelTitle}>
              {dashboardData.attentionItems.length === 1
                ? '1 lucru de rezolvat'
                : `${dashboardData.attentionItems.length} lucruri de rezolvat`}
            </p>
          </div>
          {!dashboardData.hasAnyRecords ? (
            <EmptyState
              variant={EMPTY_STATES['dashboard.attention.first'].variant}
              size="compact"
              title={resolveEmptyStateTitle(EMPTY_STATES['dashboard.attention.first'])}
              action={{
                label: EMPTY_STATES['dashboard.attention.first'].actionLabel ?? '',
                onClick: () => onNavigate('children', { nou: '1' }),
              }}
            />
          ) : dashboardData.allClear ? (
            <EmptyState
              variant={EMPTY_STATES['dashboard.attention.done'].variant}
              size="compact"
              title={resolveEmptyStateTitle(EMPTY_STATES['dashboard.attention.done'])}
            />
          ) : (
            <div className={styles.attentionList}>
              {dashboardData.attentionItems.map(item => (
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
            {dashboardData.upcomingBirthdays.length === 0 &&
              (dashboardData.nextBirthday ? (
                <div className={styles.birthdaysEmptyCard}>
                  <p className={styles.birthdaysEmptyText}>Nimeni în următoarele 5 zile.</p>
                  <div className={styles.birthdayNextRow}>
                    <span className={`${styles.avatar} ${AVATAR_TONE_CLASS[0]}`}>
                      {initials(dashboardData.nextBirthday.child.name)}
                    </span>
                    <div>
                      <span className={styles.birthdayNextLabel}>URMĂTOAREA</span>
                      <strong>{dashboardData.nextBirthday.child.name}</strong>
                      <small>
                        {formatShortDayMonth(dashboardData.nextBirthday.child.birthDate)} · împlinește{' '}
                        {dashboardData.nextBirthday.turningAge}{' '}
                        {dashboardData.nextBirthday.turningAge === 1 ? 'an' : 'ani'}
                      </small>
                    </div>
                    <span className={styles.birthdayPillGray}>în {dashboardData.nextBirthday.daysUntil} zile</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  variant={EMPTY_STATES['dashboard.birthdays'].variant}
                  size="compact"
                  title={resolveEmptyStateTitle(EMPTY_STATES['dashboard.birthdays'])}
                />
              ))}
            {dashboardData.upcomingBirthdays.map(
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
              <Button
                variant="link"
                className={styles.birthdaysCalendarLink}
                onClick={() => navigate(`/copii/zile-de-nastere?luna=${month}`)}
              >
                Vezi calendarul →
              </Button>
            </div>
            <div className={styles.birthdaysCalendar}>
              {monthBirthdayCells.length === 0 ? (
                <p className={styles.birthdaysMonthEmpty}>
                  Fără zile de naștere în {MONTH_NAMES[Number(month.slice(5, 7)) - 1]}
                </p>
              ) : (
                monthBirthdayCells.flatMap(cell => {
                  const upcoming = cell.date >= todayFn();
                  return cell.names.map((child: { name: string }, index: number) => (
                    <div
                      key={`${cell.date}-${index}`}
                      className={upcoming ? styles.calendarCellUpcoming : styles.calendarCellPast}
                    >
                      <strong>{cell.day}</strong>
                      <span>{child.name}</span>
                    </div>
                  ));
                })
              )}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

// 45c (PROMPT-8 §14): „apar doar elementele care au o acțiune” — useDashboard filtrează deja
// sursele cu count 0 / backup la zi, deci fiecare rând ajuns aici are mereu un CTA.
function AttentionRow({
  item,
  onNavigate,
}: {
  item: AttentionItem;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}) {
  return (
    <article className={`${styles.attentionRow} ${ATTENTION_TONE_CLASS[item.tone]}`}>
      <span className={styles.attentionCount}>{item.count}</span>
      <div className={styles.attentionText}>
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </div>
      <Button
        variant="link"
        tone="inherit"
        className={styles.attentionAction}
        onClick={() => onNavigate(item.view as ViewKey, item.params)}
      >
        {item.action} →
      </Button>
    </article>
  );
}
