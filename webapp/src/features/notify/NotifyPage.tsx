import { Card, useToast } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { useNotify, type NotifyRowView } from './useNotify';
import type { ViewKey } from '@shared/view-key';
import styles from './NotifyPage.module.css';

export interface NotifyPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
}

export function NotifyPage({ month, onNavigate }: NotifyPageProps) {
  const data = useNotify(month);
  const toast = useToast();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function copyAll() {
    const { notice } = await data.copyAllMessages();
    toast.show({ message: notice });
  }

  async function copyOne(message: string) {
    const { notice } = await data.copyMessage(message);
    toast.show({ message: notice });
  }

  return (
    <>
      <div className={styles.headerActions}>
        <p className={styles.period}>{data.periodLabel}</p>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={() => void copyAll()}>
            Copiază toate mesajele
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
            Tipărește lista
          </button>
        </div>
      </div>

      <p className={styles.notice}>
        Copiii care au de achitat luna selectată, indiferent cât de aproape e scadența. Scadența este ziua din data
        contractului; cei cu scadența trecută apar evidențiați ca restanță. Cei fără taxă sau fără perioadă confirmată
        nu pot fi evaluați și apar la „De verificat".
      </p>

      <div className={styles.statsRow}>
        <Card tone="pink" className={styles.statCard}>
          <p className={styles.statLabel}>Cu întârziere</p>
          <strong className={styles.statValue}>{data.stats.late}</strong>
          <small>scadența a trecut</small>
        </Card>
        <Card tone="yellow" className={styles.statCard}>
          <p className={styles.statLabel}>Nescadente încă</p>
          <strong className={styles.statValue}>{data.stats.soon}</strong>
          <small>de plată, dar scadența n-a trecut</small>
        </Card>
        <Card tone="orange" className={styles.statCard}>
          <p className={styles.statLabel}>Sumă de încasat</p>
          <strong className={styles.statValue}>{formatMoney(data.stats.owed)}</strong>
          <small>total pe lista de mai jos</small>
        </Card>
        <Card tone="mint" className={styles.statCard}>
          <p className={styles.statLabel}>Nu pot fi evaluați</p>
          <strong className={styles.statValue}>{data.stats.unknown}</strong>
          <small>fără taxă sau perioadă confirmată</small>
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Copil</th>
              <th>Părinte / telefon</th>
              <th>Grupă</th>
              <th>Scadență</th>
              <th>Termen</th>
              <th className={styles.alignEnd}>Taxă</th>
              <th className={styles.alignEnd}>Achitat</th>
              <th className={styles.alignEnd}>Rest</th>
              <th>Situație</th>
              <th>Mesaj</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={11} className={styles.empty}>
                  {data.emptyMessage}
                </td>
              </tr>
            ) : (
              data.rows.map(row => <NotifyRow key={row.id} row={row} onNavigate={onNavigate} onCopy={copyOne} />)
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function NotifyRow({
  row,
  onNavigate,
  onCopy,
}: {
  row: NotifyRowView;
  onNavigate: (view: ViewKey) => void;
  onCopy: (message: string) => void;
}) {
  return (
    <tr className={row.late ? styles.lateRow : undefined}>
      <td>{row.contract}</td>
      <td>{row.name}</td>
      <td>
        {row.contacts.map((contact, index) => (
          <div key={index}>
            {contact.name}
            {contact.phone && <div>{contact.phone}</div>}
          </div>
        ))}
      </td>
      <td>{row.groupLabel}</td>
      <td>{row.dueLabel}</td>
      <td>{row.termLabel}</td>
      <td className={styles.alignEnd}>{formatMoney(row.expected)}</td>
      <td className={styles.alignEnd}>{formatMoney(row.paid)}</td>
      <td className={styles.alignEnd}>
        <strong>{formatMoney(row.rest)}</strong>
      </td>
      <td>
        {row.label}
        {row.hasUnassignedHint && (
          <>
            {' '}
            <button type="button" className={styles.hintLink} onClick={() => onNavigate('assign')}>
              posibilă plată neasociată
            </button>
          </>
        )}
      </td>
      <td>
        <button type="button" className={styles.btnGhostSmall} onClick={() => onCopy(row.message)}>
          Copiază
        </button>
      </td>
    </tr>
  );
}
