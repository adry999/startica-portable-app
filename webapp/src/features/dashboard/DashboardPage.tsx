import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  EMPTY_STATES,
  EmptyState,
  Legend,
  LoadingState,
  ProgressBar,
  Tooltip,
  resolveEmptyStateTitle,
  type LegendTone,
  type ProgressBarTone,
} from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
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
const ATTENTION_TONE_CLASS: Record<AttentionTone, string> = {
  urgent: styles.tonePink,
  review: styles.toneYellow,
  assign: styles.toneMint,
  visits: styles.toneYellow,
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

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

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
  const maxRevenue = Math.max(1, ...chartMonths.flatMap(bar => [bar.income, bar.expense]));

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
              <p className={styles.panelSubtitle}>Ultimele 12 luni</p>
            </div>
            <Legend
              className={styles.chartLegend}
              items={[
                { tone: 'orange', label: 'Încasări' },
                { tone: 'mint', label: 'Cheltuieli' },
              ]}
            />
          </div>
          <div className={styles.bars}>
            {chartMonths.map((bar, index) => {
              const isCurrent = index === currentMonthIndex;
              const diff = bar.income - bar.expense;
              return (
                <div key={bar.month} className={styles.barColumn}>
                  <Tooltip
                    content={`${capitalize(fullMonthLabel(bar.month))} · diferență ${formatCompactMoney(diff)} lei`}
                  >
                    <button
                      type="button"
                      className={styles.barPair}
                      aria-label={`${fullMonthLabel(bar.month)}: încasări ${formatMoney(bar.income)}, cheltuieli ${formatMoney(bar.expense)}`}
                    >
                      <span
                        className={`${styles.barIncome} ${isCurrent ? styles.barIncomeCurrent : ''} ${
                          bar.income === 0 ? styles.barNoData : ''
                        }`}
                        style={{ height: bar.income === 0 ? 5 : Math.max(6, (bar.income / maxRevenue) * 100) }}
                      />
                      <span
                        className={`${styles.barExpense} ${isCurrent ? styles.barExpenseCurrent : ''} ${
                          bar.expense === 0 ? styles.barNoData : ''
                        }`}
                        style={{ height: bar.expense === 0 ? 5 : Math.max(6, (bar.expense / maxRevenue) * 100) }}
                      />
                    </button>
                  </Tooltip>
                </div>
              );
            })}
          </div>
          <div className={styles.barLabels}>
            {chartMonths.map((bar, index) => (
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
          {dashboardData.allClear ? (
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
            {dashboardData.upcomingBirthdays.length === 0 && (
              <EmptyState
                variant={EMPTY_STATES['dashboard.birthdays'].variant}
                size="compact"
                title={resolveEmptyStateTitle(EMPTY_STATES['dashboard.birthdays'])}
              />
            )}
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
              {dashboardData.birthdayWeeks
                .flat()
                .filter((cell: { inMonth: boolean; names: unknown[] }) => cell.inMonth && cell.names.length > 0)
                .flatMap(cell => {
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
                })}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function AttentionRow({
  item,
  onNavigate,
}: {
  item: AttentionItem;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}) {
  const clear = item.count === 0 && !item.forceShow;
  return (
    <article className={`${styles.attentionRow} ${clear ? styles.attentionRowClear : ATTENTION_TONE_CLASS[item.tone]}`}>
      <span className={styles.attentionCount}>{item.count}</span>
      <div className={styles.attentionText}>
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </div>
      {!clear && (
        <button
          type="button"
          className={styles.attentionAction}
          onClick={() => onNavigate(item.view as ViewKey, item.params)}
        >
          {item.action} →
        </button>
      )}
    </article>
  );
}
