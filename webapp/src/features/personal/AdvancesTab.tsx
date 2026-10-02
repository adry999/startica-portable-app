import { useEffect, useState } from 'react';
import { Badge, Button, Card, LoadingState, useToast } from '@shared/ui';
import { requestJson, useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Advance } from '@shared/personal/personal.types';
import styles from './AdvancesTab.module.css';

/** Avansuri (23g) — istoricul anului; un avans scăzut nu se mai poate șterge. */
export function AdvancesTab() {
  const personal = usePersonal();
  const session = useAppSession();
  const toast = useToast();
  const year = today().slice(0, 4);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failureMessage, setFailureMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const response = (await requestJson(`/api/personal/advances?year=${year}`)) as { advances: Advance[] };
      setAdvances(response.advances);
      setStatus('ready');
    } catch (error) {
      setFailureMessage((error as Error).message);
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // Ștergerea arhivează cheltuiala avansului în filiala activă — trece prin session.mutate.
  async function remove(id: string) {
    try {
      await session.mutate('/api/personal/advances', { id, remove: true });
      await load();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (status === 'loading') return <LoadingState />;
  if (status === 'failed') return <p className={styles.notice}>{failureMessage}</p>;

  return (
    <Card className={styles.tableCard}>
      <div className={styles.headRow}>
        <span>Angajat</span>
        <span>Data</span>
        <span>Sumă</span>
        <span>Metodă</span>
        <span>Lună</span>
        <span>Stare</span>
        <span />
      </div>
      {[...advances]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(advance => {
          const deducted = Boolean(advance.deductedAt);
          return (
            <div key={advance.id} className={styles.row}>
              <span>{personal.staffById.get(advance.staffId)?.name ?? advance.staffId}</span>
              <span>{formatDate(advance.date)}</span>
              <span>{formatMoney(advance.amount)}</span>
              <span>{advance.method}</span>
              <span>{advance.month}</span>
              <span>
                <Badge tone={deducted ? 'mint' : 'yellow'}>{deducted ? 'Scăzut' : 'De scăzut'}</Badge>
              </span>
              <span>
                <Button
                  variant="danger"
                  disabled={deducted}
                  title={deducted ? 'Avansul a fost deja scăzut' : undefined}
                  onClick={() => void remove(advance.id)}
                >
                  Șterge
                </Button>
              </span>
            </div>
          );
        })}
    </Card>
  );
}
