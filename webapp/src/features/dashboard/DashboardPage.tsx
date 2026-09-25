import { Card } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { useDashboard, type AttentionItem, type AttentionTone } from './useDashboard';
import type { ViewKey } from '../../app/shell/nav-items';
import styles from './DashboardPage.module.css';

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

export interface DashboardPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
}

export function DashboardPage({ month, onNavigate }: DashboardPageProps) {
  const data = useDashboard(month);

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const currentMonthIndex = data.revenueHistory.length - 1;
  const maxRevenue = Math.max(1, ...data.revenueHistory.map(r => r.value));

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
          <p className={styles.panelTitle}>Evoluția încasărilor</p>
          <p className={styles.panelSubtitle}>Ultimele 12 luni</p>
          <div className={styles.bars}>
            {data.revenueHistory.map((bar, index) => (
              <div key={bar.month} className={styles.barColumn}>
                <span className={styles.barValue}>{formatCompactMoney(bar.value)}</span>
                <div
                  className={
                    index === currentMonthIndex ? styles.barCurrent : bar.value === 0 ? styles.barEmpty : styles.barPast
                  }
                  style={{ height: bar.value === 0 ? 6 : Math.max(6, (bar.value / maxRevenue) * 100) }}
                />
                <small className={index === currentMonthIndex ? styles.barLabelCurrent : undefined}>
                  {bar.month.slice(5)}
                </small>
              </div>
            ))}
          </div>
        </Card>

        <Card className={styles.attentionPanel}>
          <p className={styles.panelTitle}>Necesită atenție</p>
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
        <p className={styles.panelTitle}>Zile de naștere</p>
        <div className={styles.birthdaysGrid}>
          <div className={styles.birthdaysUpcoming}>
            {data.upcomingBirthdays.length === 0 && (
              <p className={styles.notice}>Nicio zi de naștere în următoarele 5 zile.</p>
            )}
            {data.upcomingBirthdays.map(
              (row: { child: { id: string; name: string }; daysUntil: number; turningAge: number }) => (
                <div key={row.child.id} className={styles.birthdayRow}>
                  <span className={styles.avatar}>{initials(row.child.name)}</span>
                  <div>
                    <strong>{row.child.name}</strong>
                    <small>
                      împlinește {row.turningAge} {row.turningAge === 1 ? 'an' : 'ani'}
                    </small>
                  </div>
                  <span className={styles.pillNeutral}>
                    {row.daysUntil === 0 ? 'azi' : row.daysUntil === 1 ? 'mâine' : `în ${row.daysUntil} zile`}
                  </span>
                </div>
              ),
            )}
          </div>
          <div className={styles.birthdaysCalendar}>
            {data.birthdayWeeks
              .flat()
              .filter((cell: { inMonth: boolean }) => cell.inMonth)
              .map(cell => (
                <div
                  key={cell.date}
                  className={`${styles.calendarCell} ${cell.isToday ? styles.calendarCellToday : ''}`}
                >
                  <strong>{cell.day}</strong>
                  {cell.names.map((n: { name: string }) => (
                    <span key={n.name} className={styles.calendarChip}>
                      {n.name}
                    </span>
                  ))}
                </div>
              ))}
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
      <span aria-hidden="true">{item.icon}</span>
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
