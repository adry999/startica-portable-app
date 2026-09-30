import { Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, groupTone, Icon, SignatureLine } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatDateLong } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { usePaymentReceipt, type PaymentReceiptData } from './usePaymentReceipt';
import styles from './PaymentReceipt.module.css';

const FX_SOURCE_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM', manual: 'corectat manual' };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || '—';

export function PaymentReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const receipt = usePaymentReceipt(id ?? '');
  const session = useAppSession();

  if (receipt.status === 'loading') return <p>Se încarcă confirmarea de plată…</p>;
  if (receipt.status === 'not-found' || !receipt.payment)
    return (
      <>
        <Button variant="white" onClick={() => navigate('/achitari')}>
          ← Achitări
        </Button>
        <p>Achitarea nu a putut fi găsită.</p>
      </>
    );

  const isA4 = receipt.kindergarten?.receiptFormat === 'a4-third';

  return (
    <div className={styles.page}>
      <style>{isA4 ? '@page { size: A4 landscape; margin: 0; }' : '@page { size: A5 portrait; margin: 12mm; }'}</style>
      <div className={styles.toolbar}>
        <Button variant="white" onClick={() => navigate(-1)}>
          ← Înapoi
        </Button>
        <Button onClick={() => window.print()}>Tipărește</Button>
        <Button variant="white" onClick={() => navigate(`/achitari/${receipt.payment?.id}/bon-58mm`)}>
          Bon 58 mm
        </Button>
      </div>
      {isA4 ? <ReceiptA4Third data={receipt} /> : <ReceiptA5 data={receipt} appVersion={session.state.version} />}
    </div>
  );
}

function KindergartenInfo({ kindergarten }: { kindergarten: PaymentReceiptData['kindergarten'] }) {
  return (
    <>
      <strong>{kindergarten?.displayName || kindergarten?.name || 'Startica'}</strong>
      {kindergarten?.idno && <span>IDNO {kindergarten.idno}</span>}
      {kindergarten?.address && <span>{kindergarten.address}</span>}
      {kindergarten?.phone && <span>{kindergarten.phone}</span>}
    </>
  );
}

function EurBlock({ data }: { data: PaymentReceiptData }) {
  const eur = data.eurBlock;
  if (!eur) return null;
  return (
    <div className={styles.eurBlock}>
      <span>
        Suma achitată: <strong>{formatMoney(eur.amountLei)}</strong> · Curs EUR{' '}
        <strong>{formatRate(eur.fxRate)}</strong> lei ({FX_SOURCE_LABEL[eur.fxRateSource]},{' '}
        {formatDate(data.payment?.date ?? '')}) · Echivalent <strong>{formatMoney(eur.amountEur, 'EUR')}</strong>
      </span>
      <span>Restul se achită în lei la cursul BNM din ziua plății.</span>
    </div>
  );
}

function ReceiptA5({ data, appVersion }: { data: PaymentReceiptData; appVersion: string }) {
  const { payment, child, kindergarten } = data;
  if (!payment) return null;
  const receiptNumber = payment.receiptNumber ? String(payment.receiptNumber).padStart(4, '0') : '—';

  return (
    <div className={styles.sheetA5}>
      <div className={styles.header}>
        {kindergarten?.logoDataUrl && <img src={kindergarten.logoDataUrl} alt="" className={styles.logo} />}
        <div className={styles.kindergartenInfo}>
          <KindergartenInfo kindergarten={kindergarten} />
        </div>
      </div>

      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Confirmare de plată</p>
          <p className={styles.receiptNumber}>Nr. {receiptNumber}</p>
        </div>
        <span className={styles.receiptDate}>{formatDateLong(payment.date)}</span>
      </div>

      <dl className={styles.detailsGrid}>
        <dt>Copil</dt>
        <dd className={styles.strong}>
          {child
            ? `${child.name} · contract nr. ${data.contractLabel}`
            : payment.childName || payment.sourceName || '—'}
        </dd>
        <dt>Plătitor</dt>
        <dd>{payment.sourceName || child?.parent || '—'}</dd>
        <dt>Metodă</dt>
        <dd>{payment.method}</dd>
      </dl>

      <div className={styles.allocationTable}>
        <div className={styles.allocationHead}>
          <span>Se repartizează pe</span>
          <span className={styles.allocationAmount}>Sumă</span>
        </div>
        {data.allocationRows.map(row => (
          <div key={row.month} className={styles.allocationRow}>
            <span>
              {row.label} · {row.statusLabel}
            </span>
            <span className={styles.allocationAmount}>{formatMoney(row.amount)}</span>
          </div>
        ))}
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Total achitat</span>
          <span className={styles.totalAmount}>{formatMoney(data.total)}</span>
        </div>
      </div>

      <p className={styles.amountInWords}>Suma în litere: {data.amountInWords}</p>

      <EurBlock data={data} />

      {data.restBox && (
        <div className={styles.restBox}>
          <span>
            <strong>Rest de achitat:</strong> {formatMoney(data.restBox.amount, data.restBox.currency)}
          </span>
          <span>scadent {formatDate(data.restBox.dueLabel)}</span>
        </div>
      )}

      <div className={styles.signatures}>
        <SignatureLine>
          Primit: {kindergarten?.signatureLabel || kindergarten?.administrator || 'administrator'}
        </SignatureLine>
        <SignatureLine>Plătitor</SignatureLine>
      </div>

      <p className={styles.footer}>
        {kindergarten?.footerNote || 'Document intern de confirmare a plății. Nu ține locul bonului fiscal.'} · Generat
        din Startica{appVersion ? ` v${appVersion}` : ''}
      </p>
    </div>
  );
}

function ReceiptA4Third({ data }: { data: PaymentReceiptData }) {
  const { payment, child, kindergarten } = data;
  if (!payment) return null;
  const receiptNumber = payment.receiptNumber ? String(payment.receiptNumber).padStart(4, '0') : '—';

  return (
    <div className={styles.sheetA4}>
      <div className={styles.kindergartenCopy}>
        <div className={styles.kindergartenCopyHead}>
          <span className={styles.copyTag}>Exemplar grădiniță</span>
          <div className={styles.kindergartenCopyNumberRow}>
            <p className={styles.kindergartenCopyNumber}>Nr. {receiptNumber}</p>
            <span className={styles.kindergartenCopyDate}>{formatDate(payment.date)}</span>
          </div>
        </div>
        <dl className={styles.kindergartenCopyDetails}>
          <dt>Copil</dt>
          <dd>
            {child ? `${child.name} · nr. ${data.contractLabel}` : payment.childName || payment.sourceName || '—'}
          </dd>
          {data.groupName && (
            <>
              <dt>Grupa</dt>
              <dd>{data.groupName}</dd>
            </>
          )}
          <dt>Plătitor</dt>
          <dd>{payment.sourceName || child?.parent || '—'}</dd>
          <dt>Metodă</dt>
          <dd>{payment.method}</dd>
          {data.allocationRows.map(row => (
            <Fragment key={row.month}>
              <dt>{row.label.replace('Taxă ', '')}</dt>
              <dd>{formatMoney(row.amount)}</dd>
            </Fragment>
          ))}
        </dl>
        <div className={styles.kindergartenCopyTotal}>
          <strong>Total</strong>
          <span className={styles.kindergartenCopyTotalAmount}>{formatMoney(data.total)}</span>
        </div>
        <div className={styles.kindergartenCopySignatures}>
          <SignatureLine>
            Primit: {kindergarten?.signatureLabel || kindergarten?.administrator || 'administrator'}
          </SignatureLine>
          <SignatureLine>Plătitor</SignatureLine>
        </div>
      </div>

      <div className={styles.cutLine}>
        <span className={styles.cutLabel}>Tăiați aici</span>
        <span className={styles.stamp}>L.Ș.</span>
      </div>

      <div className={styles.parentCopy}>
        <div className={styles.parentBand}>
          <span className={styles.parentBandCircleOrange} />
          <span className={styles.parentBandCirclePink} />
          <span className={styles.parentBandCircleMint} />
          <div className={styles.parentBandIcon}>{child ? initialsOf(child.name) : 'S'}</div>
          <div className={styles.parentBandTitle}>
            <strong>Mulțumim pentru plată!</strong>
            <span>
              {kindergarten?.displayName || kindergarten?.name || 'Grădinița Startica'} · confirmare nr. {receiptNumber}{' '}
              din {formatDateLong(payment.date)}
            </span>
          </div>
        </div>

        <div className={styles.parentBody}>
          <div className={styles.childRow}>
            <span className={styles.childAvatar}>{child ? initialsOf(child.name) : '—'}</span>
            <div className={styles.childInfo}>
              <div className={styles.childName}>
                <strong>{child?.name ?? payment.childName ?? payment.sourceName ?? 'Copil neasociat'}</strong>
                {child && data.groupName && (
                  <Badge tone={groupTone(child.groupId ?? '', data.groups)}>Grupa {data.groupName}</Badge>
                )}
              </div>
              <span className={styles.childMeta}>
                Contract nr. {data.contractLabel} · plătit de {payment.sourceName || child?.parent || '—'},{' '}
                {payment.method}
              </span>
            </div>
            <div className={styles.paidAmount}>
              <span>Achitat</span>
              <strong>{formatMoney(data.total)}</strong>
            </div>
          </div>

          {data.yearMonths.length > 0 && (
            <div>
              <div className={styles.yearBandHead}>
                <span>Anul {payment.date.slice(0, 4)}</span>
                <span>după această plată</span>
              </div>
              <div className={styles.yearBand}>
                {data.yearMonths.map(cell => (
                  <div key={cell.month} className={`${styles.yearBandCell} ${styles[cell.kind]}`}>
                    <span>{cell.label.slice(0, 3)}</span>
                    <span>
                      {cell.kind === 'paid' ? (
                        <Icon name="check" size={14} />
                      ) : cell.kind === 'partial' ? (
                        'Parțial'
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.parentTable}>
            <div className={styles.parentTableHead}>
              <span>Luna</span>
              <span className={styles.parentTableAmount}>Din această plată</span>
              <span className={styles.parentTableAmount}>Rămas</span>
            </div>
            {data.allocationRows.map(row => (
              <div key={row.month} className={styles.parentTableRow}>
                <span>{row.label.replace('Taxă ', '')}</span>
                <span className={styles.parentTableAmount}>{formatMoney(row.amount)}</span>
                <span className={`${styles.parentTableRest} ${row.rest === 0 ? styles.zero : ''}`}>
                  {formatMoney(row.rest)}
                </span>
              </div>
            ))}
            <p className={styles.parentNote}>
              Suma în litere: {data.amountInWords}
              {data.restBox && ` Restul, scadent ${formatDate(data.restBox.dueLabel)}.`}
            </p>
          </div>

          <EurBlock data={data} />

          <div className={styles.parentBottom}>
            <div className={styles.parentIban}>
              {kindergarten?.iban && (
                <>
                  <strong>Pentru plata prin transfer</strong>
                  <span>
                    IBAN {kindergarten.iban} {kindergarten.bank ? `· ${kindergarten.bank}` : ''}
                  </span>
                  <span>
                    Beneficiar: {kindergarten.displayName || kindergarten.name}
                    {kindergarten.idno ? ` · IDNO ${kindergarten.idno}` : ''}
                  </span>
                </>
              )}
            </div>
            <SignatureLine>
              Primit: {kindergarten?.signatureLabel || kindergarten?.administrator || 'administrator'}
            </SignatureLine>
          </div>
          <div className={styles.parentFooter}>
            <span>
              {[kindergarten?.address, kindergarten?.phone, kindergarten?.website].filter(Boolean).join(' · ')}
            </span>
            <span>Nu ține locul bonului fiscal.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
