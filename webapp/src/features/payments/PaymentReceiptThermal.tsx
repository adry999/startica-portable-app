import { useNavigate, useParams } from 'react-router-dom';
import { Button, SignatureLine, ThermalBlock, ThermalRule } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatDateLong } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { usePaymentReceipt } from './usePaymentReceipt';
import styles from './PaymentReceiptThermal.module.css';

const MONTH_INITIALS = ['I', 'F', 'M', 'A', 'M', 'I', 'I', 'A', 'S', 'O', 'N', 'D'];
const FX_SOURCE_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM', manual: 'manual' };

/** „+0,17 lei” / „−1,83 lei” (§9.1) — fără rotunjire nu există rând, deci fără zero aici. */
function formatRoundingDiff(diff: number): string {
  return `${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff))}`;
}

/**
 * Bonul 58 mm (24a) — aceeași achitare, același număr de confirmare ca A5/A4 (usePaymentReceipt
 * asignează o singură dată, indiferent de câte formate se tipăresc). Alb-negru, 48 mm zonă de tipar.
 */
export function PaymentReceiptThermal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const receipt = usePaymentReceipt(id ?? '');

  if (receipt.status === 'loading') return <p>Se încarcă bonul…</p>;
  if (receipt.status === 'not-found' || !receipt.payment)
    return (
      <>
        <Button variant="white" onClick={() => navigate('/achitari')}>
          ← Achitări
        </Button>
        <p>Achitarea nu a putut fi găsită.</p>
      </>
    );

  const { payment, child, kindergarten } = receipt;
  const receiptNumber = payment.receiptNumber ? String(payment.receiptNumber).padStart(4, '0') : '—';

  return (
    <ThermalBlock
      actions={
        <>
          <Button variant="white" onClick={() => navigate(-1)}>
            ← Înapoi
          </Button>
          <Button onClick={() => window.print()}>Tipărește</Button>
        </>
      }
    >
      {kindergarten?.logoDataUrl && <img src={kindergarten.logoDataUrl} alt="" className={styles.logo} />}
      <div className={styles.kindergartenInfo}>
        <strong>{kindergarten?.displayName || kindergarten?.name || 'Startica'}</strong>
        {kindergarten?.idno && <span> · IDNO {kindergarten.idno}</span>}
        <br />
        {[kindergarten?.address, kindergarten?.phone].filter(Boolean).join(' · ')}
      </div>

      <ThermalRule />

      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>CONFIRMARE DE PLATĂ</span>
        <span className={styles.receiptNumber}>Nr. {receiptNumber}</span>
        <span className={styles.receiptDate}>{formatDateLong(payment.date)}</span>
      </div>

      <ThermalRule variant="dashed" />

      <dl className={styles.detailsGrid}>
        <dt>Copil</dt>
        <dd>{child ? child.name : payment.childName || payment.sourceName || '—'}</dd>
        {receipt.groupName && (
          <>
            <dt>Grupa</dt>
            <dd>{receipt.groupName}</dd>
          </>
        )}
        <dt>Plătitor</dt>
        <dd>{payment.sourceName || child?.parent || '—'}</dd>
        <dt>Metodă</dt>
        <dd>{payment.method}</dd>
      </dl>

      <ThermalRule variant="dashed" />

      {receipt.allocationRows.map(row => (
        <div key={row.month} className={styles.allocationRow}>
          <span>
            {row.label} · {row.statusLabel}
          </span>
          <strong>{formatMoney(row.amount)}</strong>
        </div>
      ))}

      {receipt.eurBlock && (
        <div className={styles.eurRow}>
          <span>
            {formatMoney(receipt.eurBlock.amountEur, 'EUR')} × {formatRate(receipt.eurBlock.fxRate)} ={' '}
            {formatMoney(receipt.eurBlock.amountLei)}
          </span>
          <span>
            curs {FX_SOURCE_LABEL[receipt.eurBlock.fxRateSource]} din {formatDate(payment.date)}
          </span>
        </div>
      )}

      {typeof payment.roundingDiff === 'number' && payment.roundingDiff !== 0 && (
        <div className={styles.roundingRow}>
          <span>Rotunjire</span>
          <strong>{formatRoundingDiff(payment.roundingDiff)}</strong>
        </div>
      )}

      <ThermalRule />

      <div className={styles.totalRow}>
        <span>TOTAL ACHITAT</span>
        <span className={styles.totalAmount}>{formatMoney(receipt.total)}</span>
      </div>

      {receipt.restBox && (
        <div className={styles.restBox}>
          <span>Rest {receipt.allocationRows.at(-1)?.label.replace('Taxă ', '')}</span>
          <strong>
            {formatMoney(receipt.restBox.amount, receipt.restBox.currency)} · scadent{' '}
            {formatDate(receipt.restBox.dueLabel)}
          </strong>
        </div>
      )}

      {receipt.yearMonths.length > 0 && (
        <>
          <div className={styles.monthDots}>
            {receipt.yearMonths.map((cell, index) => (
              <span key={cell.month} className={`${styles.monthDot} ${styles[cell.kind]}`}>
                {MONTH_INITIALS[Number(cell.month.slice(5, 7)) - 1] ?? index}
              </span>
            ))}
          </div>
          <span className={styles.monthLegend}>● achitat · ◐ parțial · ○ urmează</span>
        </>
      )}

      <ThermalRule variant="dashed" />

      <SignatureLine>
        Primit: {kindergarten?.signatureLabel || kindergarten?.administrator || 'administrator'}
      </SignatureLine>

      <span className={styles.thanks}>Mulțumim!</span>
      <span className={styles.footer}>Nu ține locul bonului fiscal.</span>
    </ThermalBlock>
  );
}
