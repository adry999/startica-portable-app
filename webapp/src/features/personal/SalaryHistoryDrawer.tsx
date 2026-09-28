import { useEffect, useState } from 'react';
import { Badge, Drawer, LoadingState } from '@shared/ui';
import { requestJson } from '@shared/api/session';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { SalaryHistoryMonth, Staff } from '@shared/personal/personal.types';
import styles from './SalaryHistoryDrawer.module.css';

export interface SalaryHistoryDrawerProps {
  staff: Staff | null;
  onClose: () => void;
}

/** Istoricul salariului unui angajat (23h) — grafic pe luni + lista de plăți. */
export function SalaryHistoryDrawer({ staff, onClose }: SalaryHistoryDrawerProps) {
  const [months, setMonths] = useState<SalaryHistoryMonth[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (!staff) return;
    setStatus('loading');
    requestJson(`/api/personal/salaries/history?staffId=${staff.id}`)
      .then(response => {
        setMonths((response as { months: SalaryHistoryMonth[] }).months);
        setStatus('ready');
      })
      .catch(() => setStatus('failed'));
  }, [staff]);

  const maxAmount = Math.max(1, ...months.map(month => month.payment?.amount ?? 0));

  return (
    <Drawer
      open={staff !== null}
      title={staff ? `Istoric salariu: ${staff.name}` : 'Istoric salariu'}
      width={480}
      onClose={onClose}
    >
      {status === 'loading' && <LoadingState />}
      {status === 'failed' && <p className={styles.notice}>Istoricul nu a putut fi încărcat.</p>}
      {status === 'ready' && (
        <div className={styles.root}>
          <div className={styles.bars}>
            {months.map(month => (
              <div key={month.month} className={styles.barColumn}>
                <div
                  className={styles.bar}
                  style={{ height: `${((month.payment?.amount ?? 0) / maxAmount) * 100}%` }}
                />
                <span>{month.month.slice(5, 7)}</span>
              </div>
            ))}
          </div>
          <ul className={styles.list}>
            {months.map(month => (
              <li key={month.month} className={styles.row}>
                <span>{formatMonthLabel(month.month)}</span>
                <span>{formatMoney(month.payment?.amount ?? null)}</span>
                {month.advances.length > 0 && (
                  <span className={styles.advancesNote}>
                    {month.advances.length} {month.advances.length === 1 ? 'avans' : 'avansuri'}
                  </span>
                )}
                <Badge tone={month.payment ? 'mint' : 'yellow'}>{month.payment ? 'Plătit' : 'De plătit'}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
