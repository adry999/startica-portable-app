import { useEffect, useRef, useState } from 'react';
import {
  AmountInput,
  BnmRateLink,
  Button,
  Checkbox,
  ChipSelect,
  DateInput,
  Drawer,
  Field,
  groupTone,
  IconButton,
  MonthInput,
  NumberInput,
  PersonCell,
  SearchSelect,
  SegmentedControl,
  TextArea,
  TextInput,
  useToast,
} from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { useSmsSend, useSmsStatus } from '@shared/sms';
import { formatMoney, formatMoneyInput } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { firstUnpaidMonth, feeEntryFor } from '@domain/tuition-obligation.mjs';
import { eurToMdlRate, convertAmount } from '@domain/exchange-rates.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { DEFAULT_SERVICE_ID, POOL_SERVICE_ID } from '@domain/record-schema.mjs';
import { sortByGroupOrder } from '@shared/format/group-order';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import {
  renderSmsTemplate,
  smsVariablesForPayment,
  PAYMENT_CONFIRMATION_TEMPLATE_BODY,
  PAYMENT_CONFIRMATION_TEMPLATE_ID,
} from '@domain/sms-template.mjs';
import { chooseSmsRecipient } from '#features/sms-notify/index.web.mjs';
import {
  defaultPaymentFormValues,
  defaultSendSmsConfirmation,
  tenderMethodsFor,
  totalOfTenders,
  type PaymentFormValues,
} from './payment-form';
import type { Child, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './PaymentFormDrawer.module.css';

export interface PaymentFormDrawerProps {
  target: Payment | 'new' | null;
  records: RecordsSnapshot;
  /** Copil presetat la creare (ex. „+ Plată" din fișa copilului) — rămâne editabil în formular. */
  defaultChildId?: string;
  /** Serviciul presetat la creare (B3) — „+ Plată” pornește cu Grădiniță, „Încasează” din Bazin cu Bazin. */
  defaultService?: string;
  /** C1: întoarce succesul real al salvării (true doar după mutate reușit) — save() din
   * dirty-forms (13b) și garda „Salvează și schimbă” a filialei se bazează pe asta. */
  onSubmit: (values: PaymentFormValues) => Promise<boolean>;
  onClose: () => void;
}

/** Tenders dinamice, alocări pe lună + 3 sincronizări automate. */
export function PaymentFormDrawer({
  target,
  records,
  defaultChildId = '',
  defaultService = DEFAULT_SERVICE_ID,
  onSubmit,
  onClose,
}: PaymentFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<PaymentFormValues>(() =>
    defaultPaymentFormValues(editing, todayFn(), defaultChildId, records, defaultService),
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
  // Observațiile pornesc ascunse în spatele unui link (15b) — deschise direct dacă există deja text.
  const [notesOpen, setNotesOpen] = useState(() => Boolean(values.notes));

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

  // Serviciile active (nu ascunse), în ordinea din 10d — ca la Group.order (15b).
  const serviceOptions = sortByGroupOrder(records.services ?? [])
    .filter(service => !service.hidden)
    .map(service => ({ value: service.id, label: service.name }));
  const isGradinitaService = values.service === DEFAULT_SERVICE_ID;
  const isBazinService = values.service === POOL_SERVICE_ID;
  // „Restul lunii” (Bazin, 15b) — din `charges` (taxa lunii curente, generată la închiderea
  // lunii); dacă luna curentă încă nu are o taxă de bazin calculată, scurtătura nu apare.
  const currentMonthCharge =
    isBazinService && selectedChild
      ? (records.charges ?? []).find(
          charge =>
            charge.childId === selectedChild.id && charge.kind === 'bazin' && charge.month === values.date.slice(0, 7),
        )
      : null;

  // Scurtăturile de lună țin de taxa lunară (Grădiniță); „restul lunii” vine din taxa de bazin deja
  // calculată pentru luna curentă — cele două nu apar niciodată simultan (B3).
  const amountShortcuts: { key: string; label: string; amount: number }[] = [];
  if (feeEntry && !isEurChild && isGradinitaService) {
    for (const months of [1, 2, 3]) {
      const amount = feeEntry.amount * months;
      amountShortcuts.push({
        key: String(months),
        label: `${months} ${months === 1 ? 'lună' : 'luni'} · ${new Intl.NumberFormat('ro-RO').format(amount)}`,
        amount,
      });
    }
  }
  if (currentMonthCharge) {
    amountShortcuts.push({
      key: 'rest',
      label: `restul lunii · ${new Intl.NumberFormat('ro-RO').format(currentMonthCharge.amount)}`,
      amount: currentMonthCharge.amount,
    });
  }

  const { rates } = useExchangeRates();
  const bnmRate = eurToMdlRate(rates, values.date);
  const effectiveRate = manualRate ? Number(manualRate) : bnmRate;
  const eurEquivalent = effectiveRate ? convertAmount(totalAmount, 'MDL', 'EUR', effectiveRate) : null;

  const toast = useToast();
  const sms = useSmsStatus();
  const smsSend = useSmsSend();
  const smsConfigured = sms.data?.configured ?? false;

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
      const next = target ? formatMoneyInput(target) : '';
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
      const child = records.children.find((c: Child) => c.id === childId);
      const next = { ...previous, childId, sendSmsConfirmation: defaultSendSmsConfirmation(child) };
      if (previous.allocations.length !== 1 || previous.allocations[0].month !== syncedMonthRef.current) return next;
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

  // 15b: trimiterea confirmării nu blochează/întârzie succesul salvării — pornește și își
  // urmează cursul separat, ca sincronizarea de pornire (non-blocking); eroarea iese doar prin toast.
  function sendPaymentConfirmation(sentValues: PaymentFormValues) {
    const child = records.children.find((c: Child) => c.id === sentValues.childId);
    const recipient = child ? chooseSmsRecipient(child) : null;
    if (!child || !recipient) {
      toast.show({ message: 'Confirmarea nu s-a trimis: fără telefon valid.' });
      return;
    }
    const month = sentValues.allocations[0]?.month || sentValues.date.slice(0, 7);
    const text = renderSmsTemplate(
      PAYMENT_CONFIRMATION_TEMPLATE_BODY,
      smsVariablesForPayment({
        child,
        parentName: recipient.parentLabel,
        amount: totalOfTenders(sentValues.tenders),
        month,
      }),
    );
    smsSend
      .send({
        source: 'notify',
        month,
        templateId: PAYMENT_CONFIRMATION_TEMPLATE_ID,
        messages: [
          {
            childId: child.id,
            childName: child.name,
            recipientName: recipient.parentLabel,
            phone: recipient.phone,
            text,
          },
        ],
      })
      .then(result => {
        const outcome = result.results[0];
        if (outcome && outcome.outcome !== 'sent') toast.show({ message: `SMS de confirmare eșuat: ${outcome.error}` });
      })
      .catch((error: Error) => toast.show({ message: `SMS de confirmare eșuat: ${error.message}` }));
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
      const saved = await onSubmit(finalValues);
      if (saved && finalValues.sendSmsConfirmation) sendPaymentConfirmation(finalValues);
      return saved;
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

  // Punctul + eticheta urmează starea (15b): achitat complet/avans = mint, plată parțială =
  // galben, neachitat = roz.
  function allocationTone(status: string | null): string {
    if (status === 'plată parțială') return styles.yellow;
    if (status === 'neachitat') return styles.pink;
    return styles.mint;
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
              <Button variant="link" className={styles.linkButton} onClick={() => setPickerOpen(true)}>
                Schimbă
              </Button>
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

        {serviceOptions.length > 0 && (
          <div className={styles.field}>
            Serviciu
            <SegmentedControl
              ariaLabel="Serviciu"
              value={values.service}
              onChange={service => setValues(previous => ({ ...previous, service }))}
              options={serviceOptions}
            />
          </div>
        )}

        <div className={styles.field}>
          Sumă
          {splitByMethod ? (
            <div className={styles.allocationRows}>
              {methods.map(method => (
                <Field key={method} label={method} htmlFor={`tender-${method}`}>
                  <NumberInput
                    id={`tender-${method}`}
                    min={0}
                    step="0.01"
                    value={values.tenders[method] ?? ''}
                    onChange={value => setTender(method, value)}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <AmountInput
              ariaLabel="Sumă"
              min={0}
              step="0.01"
              value={values.tenders[activeMethod] ?? ''}
              onChange={value => setTender(activeMethod, value)}
              currency="lei"
              shortcuts={
                amountShortcuts.length > 0 ? (
                  <ChipSelect
                    ariaLabel="Sumă rapidă"
                    options={amountShortcuts.map(shortcut => ({ value: shortcut.key, label: shortcut.label }))}
                    value={amountShortcuts.find(s => Number(values.tenders[activeMethod]) === s.amount)?.key ?? ''}
                    onChange={key => {
                      const shortcut = amountShortcuts.find(s => s.key === key);
                      if (shortcut) setTender(activeMethod, String(shortcut.amount));
                    }}
                  />
                ) : undefined
              }
            />
          )}
          {splitByMethod ? (
            <p className={styles.balance}>Total: {formatMoney(totalAmount, 'MDL')}</p>
          ) : (
            <Button variant="link" className={styles.linkButton} onClick={() => setSplitByMethod(true)}>
              Împarte pe metode
            </Button>
          )}
          {isEurChild && (
            <>
              <p className={styles.notice}>= {formatMoney(eurEquivalent, 'EUR')}</p>
              <Field label="Curs EUR" htmlFor="payment-eur-rate">
                <NumberInput
                  id="payment-eur-rate"
                  step="0.0001"
                  min={0}
                  placeholder={bnmRate !== undefined ? String(bnmRate) : ''}
                  value={manualRate}
                  onChange={setManualRate}
                />
              </Field>
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
          <Field label="Data" htmlFor="payment-date">
            <DateInput id="payment-date" required value={values.date} onChange={setDate} />
          </Field>
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

        <div className={styles.field}>
          {allocationMode === 'auto' ? (
            <>
              Se repartizează automat
              <div className={styles.autoList}>
                {values.allocations.map(row => {
                  const status = allocationStatus(row);
                  const tone = allocationTone(status);
                  return (
                    <div key={row.id} className={styles.autoRow}>
                      <span className={`${styles.autoDot} ${tone}`} />
                      <span className={styles.autoMonth}>{formatMonthLabel(row.month)}</span>
                      <span className={styles.autoAmount}>{formatMoney(Number(row.amount) || 0, balanceCurrency)}</span>
                      {status && <span className={`${styles.autoStatus} ${tone}`}>{status}</span>}
                    </div>
                  );
                })}
              </div>
              <Button variant="link" className={styles.linkButton} onClick={() => setAllocationMode('manual')}>
                Repartizează manual
              </Button>
            </>
          ) : (
            <>
              Repartizare manuală
              <p className={styles.notice}>Suma rămasă nerepartizată este evidențiată ca avans.</p>
              <div className={styles.allocationRows}>
                {values.allocations.map((row, index) => (
                  <div key={row.id} className={styles.allocationRow}>
                    <div className={styles.allocationField}>
                      <Field label="Luna" htmlFor={`allocation-month-${row.id}`}>
                        <MonthInput
                          id={`allocation-month-${row.id}`}
                          required
                          value={row.month}
                          onChange={value => setAllocationField(index, 'month', value)}
                        />
                      </Field>
                    </div>
                    <div className={styles.allocationAmountField}>
                      <Field label="Suma" htmlFor={`allocation-amount-${row.id}`}>
                        <NumberInput
                          id={`allocation-amount-${row.id}`}
                          required
                          min={0.01}
                          step="0.01"
                          value={row.amount}
                          onChange={value => setAllocationField(index, 'amount', value)}
                        />
                      </Field>
                    </div>
                    <IconButton
                      icon="close"
                      className={styles.removeRow}
                      ariaLabel="Elimină repartizarea"
                      onClick={() => removeAllocationRow(index)}
                    />
                  </div>
                ))}
              </div>
              <Button variant="ghost" onClick={addAllocationRow}>
                + Lună
              </Button>
              <p className={styles.balance}>
                Repartizat: {formatMoney(allocated, balanceCurrency)} · Nerepartizat:{' '}
                {formatMoney(balanceTotal - allocated, balanceCurrency)}
              </p>
              <Button variant="link" className={styles.linkButton} onClick={() => setAllocationMode('auto')}>
                Se repartizează automat
              </Button>
            </>
          )}
        </div>

        <Field label="Plătitor" htmlFor="payment-source-name">
          <TextInput
            id="payment-source-name"
            placeholder="Numele din extras, dacă diferă de părinte"
            value={values.sourceName}
            onChange={value => setValues(p => ({ ...p, sourceName: value }))}
          />
        </Field>

        {editing?.verification && (
          <fieldset className={styles.section}>
            <legend>Verificare import</legend>
            <label className={styles.checkboxField}>
              <Checkbox
                checked={values.reviewed}
                onChange={checked => setValues(p => ({ ...p, reviewed: checked }))}
                ariaLabel="Am verificat observațiile importului"
              />
              <span>Am verificat observațiile importului</span>
            </label>
            <p className={styles.notice}>{editing.verification}</p>
          </fieldset>
        )}

        {notesOpen ? (
          <Field label="Observații" htmlFor="payment-notes">
            <TextArea
              id="payment-notes"
              rows={3}
              autoFocus
              value={values.notes}
              onChange={value => setValues(p => ({ ...p, notes: value }))}
            />
          </Field>
        ) : (
          <Button variant="link" className={styles.linkButton} onClick={() => setNotesOpen(true)}>
            + Adaugă observație
          </Button>
        )}

        <label className={styles.checkboxField}>
          <Checkbox
            checked={values.sendSmsConfirmation}
            onChange={checked => setValues(p => ({ ...p, sendSmsConfirmation: checked }))}
            disabled={!smsConfigured}
            ariaLabel="Trimite confirmare părintelui prin SMS"
          />
          <span>Trimite confirmare părintelui prin SMS</span>
        </label>
        {!smsConfigured && <p className={styles.notice}>SMS neconectat</p>}
      </form>
    </Drawer>
  );
}
