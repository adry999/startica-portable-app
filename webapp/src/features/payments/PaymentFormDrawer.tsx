import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { firstUnpaidMonth, feeEntryFor } from '@domain/tuition-obligation.mjs';
import { eurToMdlRate, convertAmount } from '@domain/exchange-rates.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { defaultPaymentFormValues, tenderMethodsFor, totalOfTenders, type PaymentFormValues } from './payment-form';
import type { Child, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './PaymentFormDrawer.module.css';

export interface PaymentFormDrawerProps {
  target: Payment | 'new' | null;
  records: RecordsSnapshot;
  /** Copil presetat la creare (ex. „+ Plată" din fișa copilului) — rămâne editabil în formular. */
  defaultChildId?: string;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onClose: () => void;
}

/** Tenders dinamice, alocări pe lună + 3 sincronizări automate. */
export function PaymentFormDrawer({ target, records, defaultChildId = '', onSubmit, onClose }: PaymentFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<PaymentFormValues>(() =>
    defaultPaymentFormValues(editing, todayFn(), defaultChildId, records),
  );
  const [submitting, setSubmitting] = useState(false);
  // Curs manual pentru ACEASTĂ plată (copil cu taxă EUR) — nu e o corectare de setări.
  const [manualRate, setManualRate] = useState('');

  // Luna/suma repartizării rămân legate de dată/tenders doar cât timp rândul
  // unic de alocare nu a fost încă atins manual.
  const syncedMonthRef = useRef(values.date.slice(0, 7));
  // La editare, pornim „nesincronizat”: rândul unic poate fi o alocare parțială
  // (avans), nu suma totală — nu trebuie rescris la montare.
  const syncedAmountRef = useRef(editing ? '' : values.allocations.length === 1 ? values.allocations[0].amount : '');

  const methods = tenderMethodsFor(editing);
  const totalAmount = totalOfTenders(values.tenders);

  const selectedChild = records.children.find((c: Child) => c.id === values.childId);
  const feeEntry = selectedChild ? feeEntryFor(selectedChild, values.date.slice(0, 7)) : null;
  const isEurChild = feeEntry?.currency === 'EUR';

  const { rates } = useExchangeRates();
  const bnmRate = eurToMdlRate(rates, values.date);
  const effectiveRate = manualRate ? Number(manualRate) : bnmRate;
  const eurEquivalent = effectiveRate ? convertAmount(totalAmount, 'MDL', 'EUR', effectiveRate) : null;

  // O dată nouă re-propune cursul BNM al zilei — o corectare manuală anterioară nu trebuie ținută peste schimbarea datei.
  useEffect(() => {
    setManualRate('');
  }, [values.date]);

  useEffect(() => {
    if (isEurChild && !effectiveRate) return;
    setValues(previous => {
      if (previous.allocations.length !== 1) return previous;
      const row = previous.allocations[0];
      if (row.amount !== syncedAmountRef.current && row.amount !== '') return previous;
      // Copilul cu taxă EUR își scade obligația în €, deci rândul de repartizare urmărește
      // echivalentul în € al sumei primite în lei, nu suma în lei ca la un copil MDL.
      const target = isEurChild ? eurEquivalent : totalAmount;
      const next = target ? target.toFixed(2) : '';
      syncedAmountRef.current = next;
      if (row.amount === next) return previous;
      return { ...previous, allocations: [{ ...row, amount: next }] };
    });
    // Doar aceste valori declanșează resincronizarea — restul stării trăiește în closure-ul updater-ului.
  }, [totalAmount, isEurChild, effectiveRate, eurEquivalent]);

  function setTender(method: string, amount: string) {
    setValues(previous => ({ ...previous, tenders: { ...previous.tenders, [method]: amount } }));
  }

  function setDate(date: string) {
    setValues(previous => {
      const next = { ...previous, date };
      if (previous.allocations.length !== 1 || previous.allocations[0].month !== syncedMonthRef.current) return next;
      const nextMonth = date.slice(0, 7);
      syncedMonthRef.current = nextMonth;
      return { ...next, allocations: [{ ...previous.allocations[0], month: nextMonth }] };
    });
  }

  function setChildId(childId: string) {
    setValues(previous => {
      const next = { ...previous, childId };
      if (previous.allocations.length !== 1 || previous.allocations[0].month !== syncedMonthRef.current) return next;
      const child = records.children.find((c: Child) => c.id === childId);
      const suggested = child && firstUnpaidMonth(child, records.payments);
      if (!suggested || suggested === syncedMonthRef.current) return next;
      syncedMonthRef.current = suggested;
      return { ...next, allocations: [{ ...previous.allocations[0], month: suggested }] };
    });
  }

  function setAllocationField(index: number, field: 'month' | 'amount', value: string) {
    setValues(previous => ({
      ...previous,
      allocations: previous.allocations.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  }

  function addAllocationRow() {
    setValues(previous => ({
      ...previous,
      allocations: [...previous.allocations, { id: crypto.randomUUID(), month: '', amount: '' }],
    }));
  }

  function removeAllocationRow(index: number) {
    setValues(previous => ({ ...previous, allocations: previous.allocations.filter((_, i) => i !== index) }));
  }

  async function handleSubmit() {
    if (submitting) return;
    if (isEurChild && !effectiveRate) return;
    setSubmitting(true);
    try {
      const finalValues = isEurChild
        ? {
            ...values,
            fxRate: effectiveRate,
            amountEur: convertAmount(totalAmount, 'MDL', 'EUR', effectiveRate!) ?? undefined,
          }
        : values;
      await onSubmit(finalValues);
    } finally {
      setSubmitting(false);
    }
  }

  const allocated = values.allocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const balanceCurrency = isEurChild ? 'EUR' : 'MDL';
  const balanceTotal = isEurChild ? (eurEquivalent ?? 0) : totalAmount;
  const childOptions = [...records.children].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: achitare' : 'Adaugă: achitare'}
      width={560}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form="payment-form-drawer"
          className={styles.btnPrimary}
          disabled={submitting || (isEurChild && !effectiveRate)}
        >
          Salvează
        </button>
      }
    >
      <form
        id="payment-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset className={styles.section}>
          <legend>Copil și dată</legend>
          <label className={styles.field}>
            Copil
            <select value={values.childId} onChange={event => setChildId(event.target.value)}>
              <option value="">Copil neasociat</option>
              {childOptions.map(child => (
                <option key={child.id} value={child.id}>
                  {child.name}
                  {child.archived ? ' (arhivat)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Data încasării
            <input type="date" required value={values.date} onChange={event => setDate(event.target.value)} />
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Sumă și metodă</legend>
          <label className={styles.field}>
            Total achitare (calculat automat)
            <input type="number" readOnly step="0.01" value={totalAmount.toFixed(2)} />
          </label>
          {isEurChild && (
            <>
              <p className={styles.notice}>= {formatMoney(eurEquivalent, 'EUR')}</p>
              <label className={styles.field}>
                Curs EUR
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  placeholder={bnmRate !== undefined ? String(bnmRate) : ''}
                  value={manualRate}
                  onChange={event => setManualRate(event.target.value)}
                />
              </label>
              <p className={styles.notice}>
                {manualRate
                  ? 'Curs manual (pentru această plată)'
                  : bnmRate !== undefined
                    ? `BNM ${formatDate(values.date)}`
                    : 'Niciun curs cunoscut pentru această dată — completează manual'}
              </p>
            </>
          )}
          <p className={styles.notice}>
            Completează una sau mai multe metode. Totalul se calculează automat; repartizarea pe luni folosește acest
            total o singură dată.
          </p>
          {methods.map(method => (
            <label key={method} className={styles.field}>
              {method}
              <input
                type="number"
                min={0}
                step="0.01"
                value={values.tenders[method] ?? ''}
                onChange={event => setTender(method, event.target.value)}
              />
            </label>
          ))}
          <label className={styles.field}>
            Nume din sursă / plătitor
            <input
              value={values.sourceName}
              onChange={event => setValues(p => ({ ...p, sourceName: event.target.value }))}
            />
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Repartizare pe luni</legend>
          <p className={styles.notice}>Suma rămasă nerepartizată este evidențiată ca avans.</p>
          <div className={styles.allocationRows}>
            {values.allocations.map((row, index) => (
              <div key={row.id} className={styles.allocationRow}>
                <label className={styles.allocationField}>
                  Luna
                  <input
                    type="month"
                    required
                    value={row.month}
                    onChange={event => setAllocationField(index, 'month', event.target.value)}
                  />
                </label>
                <label className={styles.allocationField}>
                  Suma
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                    value={row.amount}
                    onChange={event => setAllocationField(index, 'amount', event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.removeRow}
                  aria-label="Elimină repartizarea"
                  onClick={() => removeAllocationRow(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.btnGhostSmall} onClick={addAllocationRow}>
            + Lună
          </button>
          <p className={styles.balance}>
            Repartizat: {formatMoney(allocated, balanceCurrency)} · Nerepartizat:{' '}
            {formatMoney(balanceTotal - allocated, balanceCurrency)}
          </p>
        </fieldset>

        {editing?.verification && (
          <fieldset className={styles.section}>
            <legend>Verificare import</legend>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={values.reviewed}
                onChange={event => setValues(p => ({ ...p, reviewed: event.target.checked }))}
              />
              <span>Am verificat observațiile importului</span>
            </label>
            <p className={styles.notice}>{editing.verification}</p>
          </fieldset>
        )}

        <label className={styles.field}>
          Observații
          <textarea
            rows={3}
            value={values.notes}
            onChange={event => setValues(p => ({ ...p, notes: event.target.value }))}
          />
        </label>
      </form>
    </Drawer>
  );
}
