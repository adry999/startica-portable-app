import { useEffect, useState, type FormEvent } from 'react';
import { Badge, BnmRateLink, Button, Card, useToast, type BadgeTone } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { useExchangeRates, type PlanPreset } from './useExchangeRates';
import backupStyles from './BackupPage.module.css';
import styles from './ExchangeRateSettings.module.css';

const SOURCE_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM · automat', manual: 'corectat manual' };
const SOURCE_HISTORY_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM', manual: 'corectat' };
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

  async function savePresets() {
    try {
      await exchangeRates.savePresets(localPresets);
      toast.show({ message: 'Planurile au fost salvate.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (!exchangeRates.ready) return <p className={backupStyles.notice}>Se încarcă cursul valutar…</p>;

  const todayRate = exchangeRates.todayRate;
  const rateTone = exchangeRates.todayTone === 'yellow' ? 'yellow' : 'mint';
  const rateIsToday = exchangeRates.rateDate === today();

  return (
    <div className={styles.grid}>
      <section className={styles.plansColumn}>
        <h3 className={backupStyles.panelTitle}>Planuri</h3>

        {localPresets.length === 0 ? (
          <p className={backupStyles.notice}>Niciun plan adăugat încă.</p>
        ) : (
          <div className={styles.planList}>
            {localPresets.map((preset, index) => (
              <div key={preset.id} className={styles.planCard}>
                <span className={`${styles.planStripe} ${styles[planTone(index)]}`} aria-hidden="true" />
                <div className={styles.planInfo}>
                  <div className={styles.planNameRow}>
                    <input
                      className={styles.planNameInput}
                      value={preset.name}
                      onChange={event => updatePreset(preset.id, { name: event.target.value })}
                      placeholder="Nume plan"
                      aria-label="Nume plan"
                    />
                    <input
                      className={styles.planHoursInput}
                      value={preset.hours ?? ''}
                      onChange={event => updatePreset(preset.id, { hours: event.target.value })}
                      placeholder="Orar, ex. 8:00–17:00"
                      aria-label="Orarul planului"
                    />
                  </div>
                  <input
                    className={styles.planDescInput}
                    value={preset.description ?? ''}
                    onChange={event => updatePreset(preset.id, { description: event.target.value })}
                    placeholder="Descriere scurtă"
                    aria-label="Descrierea planului"
                  />
                </div>
                <label className={styles.planPriceField}>
                  Preț lunar
                  <span className={styles.planPriceValue}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={preset.priceEur}
                      onChange={event => updatePreset(preset.id, { priceEur: Number(event.target.value) })}
                      aria-label="Preț lunar în euro"
                    />
                    <span className={styles.eur}>€</span>
                  </span>
                </label>
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
          <Card tone={exchangeRates.todayRate === undefined ? 'white' : rateTone} decorative>
            <div className={styles.rateHeader}>
              <span className={styles.rateEyebrow}>
                Curs EUR{exchangeRates.rateDate ? ` · ${formatDate(exchangeRates.rateDate)}` : ''}
              </span>
              {exchangeRates.todayRate !== undefined && exchangeRates.todayTone && (
                <Badge tone={rateTone}>{SOURCE_LABEL[exchangeRates.todayTone === 'yellow' ? 'manual' : 'bnm']}</Badge>
              )}
            </div>

            {exchangeRates.todayRate === undefined ? (
              <>
                <span className={styles.rateValue}>Fără curs cunoscut</span>
                <Button type="button" variant="ghost" onClick={() => void refresh()}>
                  Preia de la BNM
                </Button>
              </>
            ) : (
              <>
                <span className={styles.rateValue}>1 € = {formatRate(exchangeRates.todayRate)} lei</span>
                <span className={styles.rateNote}>
                  {rateIsToday
                    ? exchangeRates.todayTone === 'yellow'
                      ? 'Corectat manual pentru azi. Se folosește la toate achitările cu data de azi.'
                      : 'Cursul BNM de azi. Se folosește la toate achitările cu data de azi.'
                    : `Cel mai recent curs cunoscut — nu s-a publicat încă un curs pentru azi.`}
                </span>
                <div className={styles.rateActions}>
                  {exchangeRates.rateDate && <BnmRateLink date={exchangeRates.rateDate} />}
                  {exchangeRates.todayTone === 'yellow' ? (
                    <Button type="button" variant="ghost" onClick={() => void refresh()}>
                      Revino la cursul BNM
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setEditingRate(true)}>
                      Corectează cursul de azi
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        {editingRate && (
          <Card className={styles.correctionCard}>
            <form className={styles.correctionForm} onSubmit={event => void submitCorrection(event)}>
              <span className={styles.correctionTitle}>Curs corectat pentru azi</span>
              <label className={backupStyles.field}>
                Curs
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={correctionInput}
                  onChange={event => setCorrectionInput(event.target.value)}
                  placeholder="ex. 19,7400"
                  autoFocus
                />
              </label>
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
          <h4 className={styles.subtitle}>Ultimele zile</h4>
          {exchangeRates.lastFiveDays.length === 0 ? (
            <p className={backupStyles.notice}>Niciun curs înregistrat încă.</p>
          ) : (
            <ul className={styles.lastFiveList}>
              {exchangeRates.lastFiveDays.map(entry => (
                <li key={entry.date} className={styles.lastFiveRow}>
                  <span className={styles.lastFiveDate}>{formatDate(entry.date)}</span>
                  <span className={styles.lastFiveRate}>1 € = {formatRate(entry.rate)} lei</span>
                  <BnmRateLink date={entry.date} />
                  {entry.source && (
                    <Badge tone={entry.source === 'bnm' ? 'mint' : 'yellow'}>
                      {SOURCE_HISTORY_LABEL[entry.source]}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <span className={styles.historyNote}>
            Cursul se ia automat de la BNM în fiecare zi lucrătoare. În weekend și de sărbători se folosește ultimul
            curs publicat.
          </span>
        </Card>
      </section>
    </div>
  );
}
