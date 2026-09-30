import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, ServiceBadge, SignatureLine, ThermalBlock, ThermalRule } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { useDayClosingReceipt } from './useDayClosingReceipt';
import styles from './DayClosingReceipt.module.css';

const METHOD_ORDER: ('Cash' | 'Card' | 'Transfer')[] = ['Cash', 'Card', 'Transfer'];

/** Bonul de închidere a zilei (24b) — plățile zilei, totalul pe metodă, cheltuielile cash și suma din casă. */
export function DayClosingReceipt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const date = searchParams.get('zi') || today();
  const closing = useDayClosingReceipt(date);

  return (
    <ThermalBlock
      actions={
        <>
          <Button variant="white" onClick={() => navigate('/achitari')}>
            ← Achitări
          </Button>
          <Button onClick={() => window.print()}>Tipărește</Button>
        </>
      }
    >
      {closing.status === 'loading' ? (
        <p>Se încarcă închiderea zilei…</p>
      ) : (
        <>
          <img src="/assets/startica-icon.svg" alt="" className={styles.icon} />
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>ÎNCHIDEREA ZILEI</span>
            <span className={styles.dayLabel}>{closing.dateLabel}</span>
          </div>

          <ThermalRule />

          {closing.rows.length === 0 ? (
            <p className={styles.notice}>Nicio achitare în această zi.</p>
          ) : (
            closing.rows.map(row => (
              <div key={row.id} className={styles.paymentRow}>
                <span className={styles.payerCell}>
                  {row.serviceLabel && <ServiceBadge service={{ name: row.serviceLabel, tone: row.serviceTone }} />}
                  <span>{row.payerLabel}</span>
                </span>
                <strong>{formatMoney(row.amount)}</strong>
              </div>
            ))
          )}

          <ThermalRule variant="dashed" />

          <dl className={styles.methodGrid}>
            {METHOD_ORDER.filter(method => closing.countsByMethod[method] > 0).map(method => (
              <span key={method} className={styles.methodRow}>
                <span>
                  {method} · {closing.countsByMethod[method]}
                </span>
                <strong>{formatMoney(closing.totalsByMethod[method])}</strong>
              </span>
            ))}
          </dl>

          {closing.cashExpenses.length > 0 && (
            <>
              <ThermalRule variant="dashed" />
              <dl className={styles.methodGrid}>
                {closing.cashExpenses.map(expense => (
                  <span key={expense.id} className={styles.methodRow}>
                    <span>{expense.description}</span>
                    <strong>−{formatMoney(expense.amount)}</strong>
                  </span>
                ))}
              </dl>
            </>
          )}

          <ThermalRule />

          <div className={styles.totalRow}>
            <span>ÎN CASĂ</span>
            <span className={styles.totalAmount}>{formatMoney(closing.inCasa)}</span>
          </div>

          <div className={styles.countedBox}>
            <div className={styles.countedRow}>
              <span>Numărat efectiv</span>
              <span>____________</span>
            </div>
            <div className={styles.countedRow}>
              <span>Diferență</span>
              <span>____________</span>
            </div>
          </div>

          <SignatureLine>Predat · Primit</SignatureLine>
        </>
      )}
    </ThermalBlock>
  );
}
