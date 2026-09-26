import { Card, useToast } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { useAssign, type AssignRowView } from './useAssign';
import styles from './AssignPage.module.css';

export interface AssignPageProps {
  month: string;
}

export function AssignPage({ month }: AssignPageProps) {
  const data = useAssign(month);
  const toast = useToast();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  function fillSuggested() {
    const count = data.fillSuggested();
    toast.show({ message: count ? `${count} rânduri completate.` : 'Nicio potrivire unică de nume găsită.' });
  }

  async function save() {
    try {
      const { saved } = await data.save();
      toast.show({ message: `${saved} achitări asociate.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <p className={styles.notice}>
        O achitare fără copil asociat nu se scade din datoria nimănui, deci un copil care a plătit poate apărea pe lista
        de notificat. Textul din sursă este adesea un prenume sau o notă, nu un nume complet, așa că nimic nu se
        asociază automat: sugestiile doar ordonează, alegerea rămâne a ta.
      </p>

      <div className={styles.riskRow}>
        <Card tone="pink" decorative className={styles.riskCard}>
          <p className={styles.riskLabel}>Achitări fără copil</p>
          <strong className={styles.riskValue}>{data.risk.unassigned}</strong>
          <small>nu se scad din datoria nimănui</small>
        </Card>
        <Card tone="yellow" className={styles.riskCard}>
          <p className={styles.riskLabel}>Din care pe luna {formatMonthLabel(month)}</p>
          <strong className={styles.riskValue}>{data.risk.coveringMonth}</strong>
          <small>{formatMoney(data.risk.amountCoveringMonth)}</small>
        </Card>
        <Card tone="orange" className={styles.riskCard}>
          <p className={styles.riskLabel}>Copii pe lista de notificat</p>
          <strong className={styles.riskValue}>{data.risk.notified}</strong>
          <small>unii pot să fi achitat deja</small>
        </Card>
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnGhost} onClick={fillSuggested}>
          Completează cu prima sugestie
        </button>
        <button type="button" className={styles.btnGhost} onClick={data.clearSelections}>
          Golește selecțiile
        </button>
      </div>

      <p className={styles.summary}>{data.summary}</p>

      <Card className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th className={styles.alignEnd}>Suma</th>
              <th>Metodă</th>
              <th>Luni acoperite</th>
              <th>Text în sursă</th>
              <th>Copil</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Nu există achitări neasociate.
                </td>
              </tr>
            ) : (
              data.rows.map(row => <AssignRow key={row.paymentId} row={row} onSelectChild={data.selectChild} />)
            )}
          </tbody>
        </table>
      </Card>

      <div className={styles.saveRow}>
        <button type="button" className={styles.btnPrimary} disabled={data.saving} onClick={() => void save()}>
          Salvează asocierile ({data.selectedCount})
        </button>
      </div>
    </>
  );
}

function AssignRow({
  row,
  onSelectChild,
}: {
  row: AssignRowView;
  onSelectChild: (id: string, childId: string) => void;
}) {
  const groups = [...new Set(row.options.map(option => option.group))];
  return (
    <tr>
      <td>{row.dateLabel}</td>
      <td className={styles.alignEnd}>
        <strong>{row.amountLabel}</strong>
      </td>
      <td>{row.method}</td>
      <td>{row.monthLines.length === 0 ? '—' : row.monthLines.map(line => <div key={line}>{line}</div>)}</td>
      <td>{row.source ? row.source : <small className={styles.notice}>fără text în sursă</small>}</td>
      <td>
        <select
          value={row.selectedChildId}
          onChange={event => onSelectChild(row.paymentId, event.target.value)}
          aria-label={`Copil pentru achitarea din ${row.dateLabel}`}
        >
          <option value="">— alege copilul —</option>
          {groups.map(group => (
            <optgroup key={group} label={group}>
              {row.options
                .filter(option => option.group === group)
                .map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </td>
    </tr>
  );
}
