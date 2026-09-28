import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { PaymentRowView } from './usePayments';
import styles from './PaymentDetailPanel.module.css';

export interface PaymentDetailPanelProps {
  payment: PaymentRowView;
  onClose: () => void;
  /** Deschide `PaymentFormDrawer` pentru achitarea asta — panoul nu duplică formularul complet
   * (tenders, alocări pe mai multe luni), doar afișează + declanșează arhivarea/tipărirea rapid. */
  onEdit: (id: string) => void;
  onToggleArchived: (payment: PaymentRowView) => void;
}

/** Panoul din dreapta al modului Pe luni (05-achitari.md §4, 400px). */
export function PaymentDetailPanel({ payment, onClose, onEdit, onToggleArchived }: PaymentDetailPanelProps) {
  const navigate = useNavigate();
  const method = payment.tenders[0]?.method ?? '—';

  return (
    <aside className={styles.panel}>
      <div className={`${styles.header} ${payment.unassigned ? styles.headerPink : styles.headerMint}`}>
        <div className={styles.headerTop}>
          <span className={styles.headerEyebrow}>Achitare · {payment.dateLabel}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Închide panoul">
            ×
          </button>
        </div>
        <strong className={styles.headerAmount}>{formatMoney(payment.total)}</strong>
        <p className={styles.headerSubtitle}>
          {method} de la <b>{payment.sourceName || payment.childLabel}</b>
          {payment.unassigned && ' · fără copil asociat'}
        </p>
      </div>

      <div className={styles.body}>
        <div className={styles.box}>
          <div className={styles.boxRow}>
            <span>Plătitor</span>
            <strong>{payment.sourceName || '—'}</strong>
          </div>
          <div className={styles.boxRow}>
            <span>Copil</span>
            <strong className={payment.unassigned ? styles.unassignedValue : undefined}>
              {payment.unassigned ? 'neasociat' : payment.childLabel}
            </strong>
          </div>
          <button
            type="button"
            className={styles.assignLink}
            onClick={() => navigate(`/asociere-achitari?id=${payment.id}`)}
          >
            Asociază în De rezolvat →
          </button>
        </div>

        <div className={styles.months}>
          <span className={styles.monthsLabel}>Luni acoperite</span>
          {payment.allocations.length === 0 ? (
            <p className={styles.notice}>Avans nerepartizat</p>
          ) : (
            payment.allocations.map(allocation => (
              <div key={allocation.month} className={styles.monthRow}>
                <span>{allocation.label}</span>
                <strong>{formatMoney(allocation.amount)}</strong>
              </div>
            ))
          )}
        </div>

        <div className={styles.fields}>
          <span className={styles.field}>
            Data
            <span className={styles.fieldValue}>{payment.dateLabel}</span>
          </span>
          <span className={styles.field}>
            Metodă
            <span className={styles.fieldValue}>{method}</span>
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.archiveLink} onClick={() => onToggleArchived(payment)}>
          {payment.archived ? 'Dezarhivează' : 'Arhivează'}
        </button>
        <Button
          variant="outline"
          className={styles.printButton}
          onClick={() => navigate(`/achitari/${payment.id}/confirmare`)}
        >
          Tipărește confirmarea
        </Button>
        <Button onClick={() => onEdit(payment.id)}>Salvează</Button>
      </div>
    </aside>
  );
}
