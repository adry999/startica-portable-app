import { useEffect, useState, type FormEvent } from 'react';
import { Badge, BnmRateLink, Button, Card, useToast } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { today } from '@domain/calendar-month.mjs';
import { useExchangeRates, type PlanPreset } from './useExchangeRates';
import backupStyles from './BackupPage.module.css';
import styles from './ExchangeRateSettings.module.css';

const SOURCE_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM', manual: 'corectat' };

export function ExchangeRateSettings() {
  const exchangeRates = useExchangeRates();
  const toast = useToast();

  const [correctionInput, setCorrectionInput] = useState('');
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

  async function savePresets() {
    try {
      await exchangeRates.savePresets(localPresets);
      toast.show({ message: 'Presetările de plan au fost salvate.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (!exchangeRates.ready) return <p className={backupStyles.notice}>Se încarcă cursul valutar…</p>;

  return (
    <>
      <Card className={backupStyles.panel}>
        <h3 className={backupStyles.panelTitle}>Curs valutar azi</h3>

        {exchangeRates.todayRate === undefined ? (
          <div className={styles.todayRow} data-testid="today-rate">
            <span className={backupStyles.notice}>Fără curs azi</span>
            <Button type="button" variant="ghost" onClick={() => void refresh()}>
              Preia de la BNM
            </Button>
          </div>
        ) : (
          <div className={styles.todayRow} data-testid="today-rate">
            <Badge tone={exchangeRates.todayTone === 'yellow' ? 'yellow' : 'mint'}>
              1 € = {formatRate(exchangeRates.todayRate)} lei
            </Badge>
            <BnmRateLink date={today()} />
            {exchangeRates.todayTone === 'yellow' && (
              <Button type="button" variant="ghost" onClick={() => void refresh()}>
                Revino la cursul BNM
              </Button>
            )}
          </div>
        )}

        <form className={backupStyles.form} onSubmit={event => void submitCorrection(event)}>
          <label className={backupStyles.field}>
            Corectează cursul de azi
            <input
              type="number"
              step="0.0001"
              min="0"
              value={correctionInput}
              onChange={event => setCorrectionInput(event.target.value)}
              placeholder="ex. 19,7400"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!correctionInput}>
            Salvează
          </Button>
        </form>

        <h4 className={styles.subtitle}>Ultimele 5 zile</h4>
        {exchangeRates.lastFiveDays.length === 0 ? (
          <p className={backupStyles.notice}>Niciun curs înregistrat încă.</p>
        ) : (
          <ul className={styles.lastFiveList}>
            {exchangeRates.lastFiveDays.map(entry => (
              <li key={entry.date} className={styles.lastFiveRow}>
                <span>{formatDate(entry.date)}</span>
                <span>
                  1 € = {formatRate(entry.rate)} lei
                  <BnmRateLink date={entry.date} />
                </span>
                {entry.source && (
                  <Badge tone={entry.source === 'bnm' ? 'mint' : 'yellow'}>{SOURCE_LABEL[entry.source]}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={backupStyles.panel}>
        <h3 className={backupStyles.panelTitle}>Presetări de plan</h3>

        {localPresets.length === 0 ? (
          <p className={backupStyles.notice}>Nicio presetare adăugată încă.</p>
        ) : (
          <div className={styles.presetsList}>
            {localPresets.map(preset => (
              <div key={preset.id} className={styles.presetRow}>
                <input
                  value={preset.name}
                  onChange={event => updatePreset(preset.id, { name: event.target.value })}
                  placeholder="Nume presetare"
                  aria-label="Nume presetare"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={preset.priceEur}
                  onChange={event => updatePreset(preset.id, { priceEur: Number(event.target.value) })}
                  placeholder="Preț €"
                  aria-label="Preț presetare în euro"
                />
                <Button type="button" variant="ghost" onClick={() => removePreset(preset.id)}>
                  Șterge
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className={backupStyles.toolbar}>
          <Button type="button" variant="ghost" onClick={addPreset}>
            + Adaugă presetare
          </Button>
          <Button type="button" variant="primary" onClick={() => void savePresets()}>
            Salvează presetările
          </Button>
        </div>
      </Card>
    </>
  );
}
