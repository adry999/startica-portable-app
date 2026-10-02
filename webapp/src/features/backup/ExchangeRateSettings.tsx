import { useEffect, useState, type FormEvent } from 'react';
import {
  Card,
  EditableList,
  EMPTY_STATES,
  Field,
  NumberInput,
  RateCalendar,
  RateCard,
  TextInput,
  resolveEmptyStateTitle,
  useToast,
  Button,
  type BadgeTone,
} from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { useAppSession } from '@shared/api/session';
import { formatMoney } from '#shared/format/money-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { feeEntryFor } from '@domain/tuition-obligation.mjs';
import { useExchangeRates, type PlanPreset } from './useExchangeRates';
import backupStyles from './BackupPage.module.css';
import styles from './ExchangeRateSettings.module.css';
import { toUserError } from '@shared/api/to-user-error';

// Culoarea benzii unui plan vine din poziția lui în listă, nu dintr-o proprietate salvată
// (planurile nu au un ID de culoare — vezi group-tone.ts pentru același model la grupe).
const PLAN_TONES: BadgeTone[] = ['orange', 'mint', 'yellow', 'pink'];
const planTone = (index: number) => PLAN_TONES[index % PLAN_TONES.length];

/** Rotunjire la ban, doar la afișare — regula 8 din 16-planuri-eur.md. */
function eurToLeiToday(priceEur: number, rate: number) {
  return Math.round(priceEur * rate * 100) / 100;
}

export function ExchangeRateSettings() {
  const exchangeRates = useExchangeRates();
  const toast = useToast();
  const session = useAppSession();

  const [correctionInput, setCorrectionInput] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [localPresets, setLocalPresets] = useState<PlanPreset[]>([]);
  const [presetsSeeded, setPresetsSeeded] = useState(false);
  const [plansMode, setPlansMode] = useState<'view' | 'edit'>('view');
  const [savingPresets, setSavingPresets] = useState(false);

  // F13 (FEEDBACK-01-10.md): „folosit de” e o potrivire pe taxa curentă (EUR, aceeași sumă) —
  // planurile nu au legătură persistentă cu fișa copilului (doar presetează fee-ul la alegere).
  const children = session.state.ready ? session.state.state.children : [];
  function usageCount(preset: PlanPreset): number {
    const month = today();
    return children.filter(child => {
      if (child.archived) return false;
      const fee = feeEntryFor(child, month);
      return fee?.currency === 'EUR' && fee.amount === preset.priceEur;
    }).length;
  }

  // Lista se editează liber în memorie; se sincronizează cu serverul o singură
  // dată, la încărcare, nu la fiecare schimbare a datelor din hook.
  useEffect(() => {
    if (exchangeRates.ready && !presetsSeeded) {
      setLocalPresets(exchangeRates.presets);
      setPresetsSeeded(true);
    }
  }, [exchangeRates.ready, exchangeRates.presets, presetsSeeded]);

  async function submitCorrection(event: FormEvent) {
    event.preventDefault();
    const rate = Number(correctionInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.show({ message: 'Curs invalid. Folosește un număr pozitiv.' });
      return;
    }
    try {
      await exchangeRates.correctToday(rate);
      setCorrectionInput('');
      setEditingRate(false);
      toast.show({ message: 'Cursul de azi a fost corectat.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function refresh() {
    try {
      const result = await exchangeRates.refreshFromBnm();
      if (result.ok) toast.show({ message: 'Cursul BNM a fost actualizat.' });
      else toast.show({ message: result.error || 'BNM indisponibil.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  function addPreset() {
    setLocalPresets(current => [...current, { id: `PLAN-${crypto.randomUUID()}`, name: '', priceEur: 0 }]);
    setPlansMode('edit');
  }

  function removePreset(id: string) {
    setLocalPresets(current => current.filter(preset => preset.id !== id));
  }

  function updatePreset(id: string, patch: Partial<PlanPreset>) {
    setLocalPresets(current => current.map(preset => (preset.id === id ? { ...preset, ...patch } : preset)));
  }

  function discardPresetChanges() {
    setLocalPresets(exchangeRates.presets);
    setPlansMode('view');
  }

  async function savePresets(): Promise<boolean> {
    setSavingPresets(true);
    try {
      await exchangeRates.savePresets(localPresets);
      toast.show({ message: 'Planurile au fost salvate.' });
      setPlansMode('view');
      return true;
    } catch (error) {
      toast.show({ message: toUserError(error) });
      return false;
    } finally {
      setSavingPresets(false);
    }
  }

  // 13b: nesalvat înseamnă că lista de planuri diferă de ultima listă confirmată de server.
  const presetsDirty = presetsSeeded && JSON.stringify(localPresets) !== JSON.stringify(exchangeRates.presets);
  useDirtyForm(presetsDirty ? { label: 'o modificare la planuri', save: savePresets } : null);

  if (exchangeRates.status === 'failed')
    return (
      <div className={backupStyles.panel}>
        <p className={backupStyles.notice}>
          {exchangeRates.failureMessage || 'Cursul valutar nu a putut fi încărcat.'}
        </p>
        <Button type="button" variant="outline" onClick={() => void exchangeRates.reload()}>
          Încearcă din nou
        </Button>
      </div>
    );
  if (!exchangeRates.ready) return <p className={backupStyles.notice}>Se încarcă cursul valutar…</p>;

  const todayRate = exchangeRates.todayRate;
  const rateIsToday = exchangeRates.rateDate === today();
  const primaryAction =
    todayRate === undefined
      ? { label: 'Preia de la BNM', onClick: () => void refresh() }
      : exchangeRates.todayTone === 'yellow'
        ? { label: 'Revino la cursul BNM', onClick: () => void refresh() }
        : { label: 'Corectează cursul de azi', onClick: () => setEditingRate(true) };

  return (
    <div className={styles.grid}>
      <section className={styles.plansColumn}>
        <EditableList
          title="Planuri"
          items={localPresets}
          getId={preset => preset.id}
          mode={plansMode}
          renderView={(preset, index) => (
            <div className={styles.planView}>
              <span className={`${styles.planStripe} ${styles[planTone(index)]}`} aria-hidden="true" />
              <div className={styles.planInfo}>
                <b className={styles.planViewName}>{preset.name || 'Plan fără nume'}</b>
                <span className={styles.planViewMeta}>
                  {usageCount(preset)} {usageCount(preset) === 1 ? 'copil' : 'copii'}
                </span>
              </div>
              <b className={styles.planViewPrice}>{preset.priceEur} €</b>
              <span className={styles.planViewApprox}>
                {todayRate === undefined ? '—' : `≈ ${formatMoney(eurToLeiToday(preset.priceEur, todayRate), 'MDL')}`}
              </span>
            </div>
          )}
          renderEdit={(preset, index) => (
            <div className={styles.planCard}>
              <span className={`${styles.planStripe} ${styles[planTone(index)]}`} aria-hidden="true" />
              <div className={styles.planInfo}>
                <div className={styles.planNameRow}>
                  <TextInput
                    className={styles.planNameInput}
                    value={preset.name}
                    onChange={value => updatePreset(preset.id, { name: value })}
                    placeholder="Nume plan"
                    ariaLabel="Nume plan"
                  />
                  <TextInput
                    className={styles.planHoursInput}
                    value={preset.hours ?? ''}
                    onChange={value => updatePreset(preset.id, { hours: value })}
                    placeholder="Orar, ex. 8:00–17:00"
                    ariaLabel="Orarul planului"
                  />
                </div>
                <TextInput
                  value={preset.description ?? ''}
                  onChange={value => updatePreset(preset.id, { description: value })}
                  placeholder="Descriere scurtă"
                  ariaLabel="Descrierea planului"
                />
              </div>
              <Field label="Preț lunar" htmlFor={`plan-price-${preset.id}`}>
                <NumberInput
                  id={`plan-price-${preset.id}`}
                  step="0.01"
                  min={0}
                  value={String(preset.priceEur)}
                  onChange={value => updatePreset(preset.id, { priceEur: Number(value) })}
                  suffix="€"
                />
              </Field>
              <div className={styles.planTodayRate}>
                <span className={styles.planTodayRateLabel}>la cursul de azi</span>
                <span className={styles.planTodayRateValue}>
                  {todayRate === undefined ? '—' : `≈ ${formatMoney(eurToLeiToday(preset.priceEur, todayRate), 'MDL')}`}
                </span>
              </div>
            </div>
          )}
          deleteHint={preset => {
            const count = usageCount(preset);
            return count > 0 ? `Folosit de ${count} ${count === 1 ? 'copil' : 'copii'}` : undefined;
          }}
          onDelete={removePreset}
          onAdd={addPreset}
          addLabel="+ Adaugă plan"
          editLabel="Editează planuri"
          onEnterEdit={() => setPlansMode('edit')}
          dirty={presetsDirty}
          saving={savingPresets}
          onSave={() => void savePresets()}
          onCancel={discardPresetChanges}
          footerNote="Planul folosit de copii nu se poate șterge. Salvează e inactiv până la prima modificare."
          emptyState={<p className={backupStyles.notice}>{resolveEmptyStateTitle(EMPTY_STATES['planuri.first'])}</p>}
        />
      </section>

      <section className={styles.rateColumn}>
        <div data-testid="today-rate">
          <RateCard
            rate={exchangeRates.todayRate}
            rateDate={exchangeRates.rateDate}
            rateIsToday={rateIsToday}
            tone={exchangeRates.todayTone}
            tomorrow={exchangeRates.tomorrow}
            primaryAction={primaryAction}
          />
        </div>

        {editingRate && (
          <Card className={styles.correctionCard}>
            <form className={styles.correctionForm} autoComplete="off" onSubmit={event => void submitCorrection(event)}>
              <span className={styles.correctionTitle}>Curs corectat pentru azi</span>
              <Field label="Curs" htmlFor="rate-correction-input">
                <NumberInput
                  id="rate-correction-input"
                  step="0.0001"
                  min={0}
                  value={correctionInput}
                  onChange={setCorrectionInput}
                  placeholder="ex. 19,7400"
                  autoFocus
                />
              </Field>
              <span className={styles.correctionHint}>Se aplică doar achitărilor din ziua de azi.</span>
              <div className={styles.correctionActions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingRate(false);
                    setCorrectionInput('');
                  }}
                >
                  Anulează
                </Button>
                <Button type="submit" variant="primary" disabled={!correctionInput}>
                  Salvează cursul
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <h4 className={styles.subtitle}>Calendar curs</h4>
          <RateCalendar
            month={exchangeRates.calendarMonth}
            onMonthChange={exchangeRates.setCalendarMonth}
            rates={exchangeRates.rates}
            sources={exchangeRates.sources}
            onBackfill={() => void exchangeRates.backfill(10)}
            backfilling={exchangeRates.backfilling}
          />
        </Card>
      </section>
    </div>
  );
}
