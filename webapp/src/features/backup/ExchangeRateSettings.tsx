import { useEffect, useState, type FormEvent } from 'react';
import {
  Card,
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
import { formatMoney } from '#shared/format/money-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { useExchangeRates, type PlanPreset } from './useExchangeRates';
import backupStyles from './BackupPage.module.css';
import styles from './ExchangeRateSettings.module.css';

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

  const [correctionInput, setCorrectionInput] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [localPresets, setLocalPresets] = useState<PlanPreset[]>([]);
  const [presetsSeeded, setPresetsSeeded] = useState(false);

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
      toast.show({ message: (error as Error).message });
    }
  }

  async function refresh() {
    try {
      const result = await exchangeRates.refreshFromBnm();
      if (result.ok) toast.show({ message: 'Cursul BNM a fost actualizat.' });
      else toast.show({ message: result.error || 'BNM indisponibil.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function addPreset() {
    setLocalPresets(current => [...current, { id: `PLAN-${crypto.randomUUID()}`, name: '', priceEur: 0 }]);
  }

  function removePreset(id: string) {
    setLocalPresets(current => current.filter(preset => preset.id !== id));
  }

  function updatePreset(id: string, patch: Partial<PlanPreset>) {
    setLocalPresets(current => current.map(preset => (preset.id === id ? { ...preset, ...patch } : preset)));
  }

  function discardPresetChanges() {
    setLocalPresets(exchangeRates.presets);
  }

  async function savePresets(): Promise<boolean> {
    try {
      await exchangeRates.savePresets(localPresets);
      toast.show({ message: 'Planurile au fost salvate.' });
      return true;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
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
        <h3 className={backupStyles.panelTitle}>Planuri</h3>

        {localPresets.length === 0 ? (
          <p className={backupStyles.notice}>{resolveEmptyStateTitle(EMPTY_STATES['planuri.first'])}</p>
        ) : (
          <div className={styles.planList}>
            {localPresets.map((preset, index) => (
              <div key={preset.id} className={styles.planCard}>
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
                    {todayRate === undefined
                      ? '—'
                      : `≈ ${formatMoney(eurToLeiToday(preset.priceEur, todayRate), 'MDL')}`}
                  </span>
                </div>
                <Button type="button" variant="ghost" onClick={() => removePreset(preset.id)}>
                  Șterge
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className={backupStyles.toolbar}>
          <Button type="button" variant="ghost" onClick={addPreset}>
            + Adaugă plan
          </Button>
          <Button type="button" variant="outline" onClick={discardPresetChanges}>
            Renunță
          </Button>
          <Button type="button" variant="primary" onClick={() => void savePresets()}>
            Salvează planurile
          </Button>
        </div>
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
