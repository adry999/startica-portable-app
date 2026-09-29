import { useEffect, useRef, useState } from 'react';
import { BnmRateLink, Button, Drawer, groupTone, PersonCell, SearchSelect, SegmentedControl } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
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
  /** C1: întoarce succesul real al salvării (true doar după mutate reușit) — save() din
   * dirty-forms (13b) și garda „Salvează și schimbă” a filialei se bazează pe asta. */
  onSubmit: (values: PaymentFormValues) => Promise<boolean>;
  onClose: () => void;
}

/** Tenders dinamice, alocări pe lună + 3 sincronizări automate. */
export function PaymentFormDrawer({ target, records, defaultChildId = '', onSubmit, onClose }: PaymentFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<PaymentFormValues>(() =>
    defaultPaymentFormValues(editing, todayFn(), defaultChildId, records),
  );
  // Valorile de la montare — comparate cu cele curente pentru garda de formular nesalvat (13b).
  const initialValuesRef = useRef(values);
  const [submitting, setSubmitting] = useState(false);
  // Curs manual pentru ACEASTĂ plată (copil cu taxă EUR) — nu e o corectare de setări.
  const [manualRate, setManualRate] = useState('');
  // Cardul copilului e implicit; „Schimbă" deschide căutarea (15b).
  const [pickerOpen, setPickerOpen] = useState(false);
  // O repartizare cu mai multe rânduri (avans pe mai multe luni) pornește direct în modul manual.
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>(
    values.allocations.length > 1 ? 'manual' : 'auto',
  );

  // Luna/suma repartizării rămân legate de dată/tenders doar cât timp rândul
  // unic de alocare nu a fost încă atins manual.
  const syncedMonthRef = useRef(values.date.slice(0, 7));
  // La editare, pornim „nesincronizat”: rândul unic poate fi o alocare parțială
  // (avans), nu suma totală — nu trebuie rescris la montare.
  const syncedAmountRef = useRef(editing ? '' : values.allocations.length === 1 ? values.allocations[0].amount : '');

  const methods = tenderMethodsFor(editing);
  // Metoda activă e cea completată deja (editare) sau prima din listă — schimbarea din
  // SegmentedControl mută suma pe noua metodă, ca „Sumă" să rămână un singur câmp (15b).
  const [activeMethod, setActiveMethod] = useState(
    () => methods.find(method => Number(values.tenders[method]) > 0) ?? methods[0],
  );
  // B1: o plată mixtă (Cash + Card, de ex.) are nevoie de mai mult de o metodă completată
  // simultan — la editarea unei asemenea plăți pornim direct despărțit.
  const [splitByMethod, setSplitByMethod] = useState(
    () => methods.filter(method => Number(values.tenders[method]) > 0).length > 1,
  );
  const totalAmount = totalOfTenders(values.tenders);

  const selectedChild = records.children.find((c: Child) => c.id === values.childId);
  const feeEntry = selectedChild ? feeEntryFor(selectedChild, values.date.slice(0, 7)) : null;
  const isEurChild = feeEntry?.currency === 'EUR';
  const unpaidMonth = selectedChild ? firstUnpaidMonth(selectedChild, records.payments) : null;
  const groupLabel = records.groups.find(group => group.id === selectedChild?.groupId)?.name ?? 'Fără grupă';

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

  // Schimbarea metodei mută suma pe cheia nouă — un singur câmp „Sumă" editabil, nu un
  // formular cu toate metodele deschise simultan.
  function selectMethod(next: string) {
    if (next === activeMethod) return;
    const amount = values.tenders[activeMethod] ?? '';
    setValues(previous => ({ ...previous, tenders: { ...previous.tenders, [activeMethod]: '', [next]: amount } }));
    setActiveMethod(next);
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
      const suggested = child && firstUnpaidMonth(child, records.payments, records.charges);
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

  async function handleSubmit(): Promise<boolean> {
    if (submitting) return false;
    if (isEurChild && !effectiveRate) return false;
    setSubmitting(true);
    try {
      const finalValues = isEurChild
        ? {
            ...values,
            fxRate: effectiveRate,
            fxRateSource: (manualRate ? 'manual' : 'bnm') as 'bnm' | 'manual',
            amountEur: convertAmount(totalAmount, 'MDL', 'EUR', effectiveRate!) ?? undefined,
          }
        : values;
      return await onSubmit(finalValues);
    } catch {
      // C1: save() nu are voie să arunce mai departe — useBranchSwitch/dirty-forms se
      // bazează pe un boolean, altfel o respingere neprinsă ar bloca „Salvează și schimbă”.
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Formular nesalvat (13b): drawer-ul rămâne montat între deschideri (key-ul din PaymentsPage
  // schimbă instanța doar la editare), deci verificăm și `target !== null` — nu doar valorile.
  const dirty = target !== null && JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'o achitare', save: handleSubmit } : null);

  const allocated = values.allocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const balanceCurrency = isEurChild ? 'EUR' : 'MDL';
  const balanceTotal = isEurChild ? (eurEquivalent ?? 0) : totalAmount;
  const childOptions = [...records.children].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const childSelectOptions = [
    { value: '', label: 'Copil neasociat' },
    ...childOptions.map(child => ({ value: child.id, label: `${child.name}${child.archived ? ' (arhivat)' : ''}` })),
  ];

  // Etichetă informativă pentru modul automat — nu recalculează obligația (asta rămâne în
  // #shared/domain/tuition-obligation.mjs), doar compară suma rândului cu taxa lunii lui.
  function allocationStatus(row: { month: string; amount: string }): string | null {
    if (!selectedChild) return null;
    const fee = feeEntryFor(selectedChild, row.month)?.amount;
    if (fee == null) return null;
    const amount = Number(row.amount) || 0;
    if (amount <= 0) return 'neachitat';
    if (amount < fee) return 'plată parțială';
    if (amount > fee) return 'avans';
    return 'achitat complet';
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează achitarea' : 'Achitare nouă'}
      width={560}
      onClose={onClose}
      footer={
        <Button type="submit" form="payment-form-drawer" disabled={submitting || (isEurChild && !effectiveRate)}>
          Salvează · {formatMoney(totalAmount, 'MDL')}
        </Button>
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
        <div className={styles.field}>
          Copil
          {selectedChild && !pickerOpen ? (
            <div className={styles.childCard}>
              <PersonCell
                name={selectedChild.name}
                tone={groupTone(selectedChild.groupId, records.groups)}
                sub={
                  <>
                    {groupLabel}
                    {feeEntry && <> · taxă {formatMoney(feeEntry.amount, feeEntry.currency)}</>}
                    {unpaidMonth && <> · {formatMonthLabel(unpaidMonth)} neachitat</>}
                  </>
                }
              />
              <button type="button" className={styles.linkButton} onClick={() => setPickerOpen(true)}>
                Schimbă
              </button>
            </div>
          ) : (
            <SearchSelect
              ariaLabel="Copil"
              options={childSelectOptions}
              value={values.childId}
              onChange={childId => {
                setChildId(childId);
                setPickerOpen(false);
              }}
            />
          )}
        </div>

        <div className={styles.field}>
          Sumă
          {splitByMethod ? (
            <div className={styles.allocationRows}>
              {methods.map(method => (
                <label key={method} className={styles.allocationField}>
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
            </div>
          ) : (
            <div className={styles.sumBox}>
              <input
                type="number"
                min={0}
                step="0.01"
                aria-label="Sumă"
                className={styles.sumInput}
                value={values.tenders[activeMethod] ?? ''}
                onChange={event => setTender(activeMethod, event.target.value)}
              />
              <span className={styles.sumCurrency}>lei</span>
            </div>
          )}
          {splitByMethod ? (
            <p className={styles.balance}>Total: {formatMoney(totalAmount, 'MDL')}</p>
          ) : (
            <button type="button" className={styles.linkButton} onClick={() => setSplitByMethod(true)}>
              Împarte pe metode
            </button>
          )}
          {feeEntry && !isEurChild && !splitByMethod && (
            <div className={styles.shortcuts}>
              {[1, 2, 3].map(months => {
                const amount = feeEntry.amount * months;
                const active = Number(values.tenders[activeMethod]) === amount;
                return (
                  <button
                    key={months}
                    type="button"
                    className={active ? `${styles.shortcut} ${styles.shortcutActive}` : styles.shortcut}
                    onClick={() => setTender(activeMethod, String(amount))}
                  >
                    {months} {months === 1 ? 'lună' : 'luni'} · {new Intl.NumberFormat('ro-RO').format(amount)}
                  </button>
                );
              })}
            </div>
          )}
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
                  ? 'Curs manual pentru această plată'
                  : bnmRate !== undefined
                    ? `BNM ${formatDate(values.date)} · ${formatRate(bnmRate)}`
                    : 'Niciun curs cunoscut pentru această dată — completează manual'}
                {values.date && <BnmRateLink date={values.date} />}
              </p>
            </>
          )}
        </div>

        <div className={splitByMethod ? undefined : styles.grid2}>
          <label className={styles.field}>
            Data
            <input type="date" required value={values.date} onChange={event => setDate(event.target.value)} />
          </label>
          {!splitByMethod && (
            <div className={styles.field}>
              Metodă
              <SegmentedControl
                ariaLabel="Metodă"
                value={activeMethod}
                onChange={selectMethod}
                options={methods.map(method => ({ value: method, label: method }))}
              />
            </div>
          )}
        </div>

        <label className={styles.field}>
          Nume din sursă / plătitor
          <input
            value={values.sourceName}
            onChange={event => setValues(p => ({ ...p, sourceName: event.target.value }))}
          />
        </label>

        <div className={styles.field}>
          {allocationMode === 'auto' ? (
            <>
              Se repartizează automat
              <div className={styles.autoList}>
                {values.allocations.map(row => (
                  <div key={row.id} className={styles.autoRow}>
                    <span className={styles.autoDot} />
                    <span className={styles.autoMonth}>{formatMonthLabel(row.month)}</span>
                    <span className={styles.autoAmount}>{formatMoney(Number(row.amount) || 0, balanceCurrency)}</span>
                    {allocationStatus(row) && <span className={styles.autoStatus}>{allocationStatus(row)}</span>}
                  </div>
                ))}
              </div>
              <button type="button" className={styles.linkButton} onClick={() => setAllocationMode('manual')}>
                Repartizează manual
              </button>
            </>
          ) : (
            <>
              Repartizare manuală
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
              <button type="button" className={styles.linkButton} onClick={() => setAllocationMode('auto')}>
                Se repartizează automat
              </button>
            </>
          )}
        </div>

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
