import type { FormEvent } from 'react';
import { Card, useToast } from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { useTelegramStatus, type TelegramStatusView } from './useTelegramStatus';
import { useNotificationPreferences } from './useNotificationPreferences';
import styles from './NotificationsPage.module.css';

export function NotificationsPage() {
  return (
    <>
      <TelegramSection />
      <PreferencesSection />
    </>
  );
}

function TelegramSection() {
  const telegram = useTelegramStatus();
  const toast = useToast();

  async function connect(event: FormEvent) {
    event.preventDefault();
    try {
      await telegram.connect();
      toast.show({ message: 'Bot conectat. Ai primit un mesaj de probă în Telegram.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function sendTest() {
    try {
      await telegram.sendTest();
      toast.show({ message: 'Mesaj de probă trimis.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function disconnect() {
    try {
      await telegram.disconnect();
      toast.show({ message: 'Telegram deconectat.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <Card className={styles.panel}>
      <h3 className={styles.panelTitle}>Telegram</h3>

      {telegram.status === 'loading' && <p className={styles.notice}>Se încarcă starea…</p>}
      {telegram.status === 'failed' && <p className={styles.error}>{telegram.failureMessage}</p>}
      {telegram.status === 'ready' && telegram.data && <TelegramStatus data={telegram.data} />}

      {telegram.status === 'ready' && telegram.data && !telegram.data.configured && (
        <form className={styles.form} onSubmit={event => void connect(event)}>
          <label className={styles.field}>
            Token-ul botului
            <input
              type="password"
              autoComplete="off"
              placeholder="123456789:AAH…"
              value={telegram.tokenInput}
              onChange={event => telegram.setTokenInput(event.target.value)}
            />
          </label>
          <p className={styles.hint}>
            Pentru o singură persoană: deschide botul, apasă Start. Pentru mai multe persoane: adaugă botul într-un grup
            Telegram și scrie acolo „/start@NumeleBotului".
          </p>
          <button type="submit" className={styles.btnPrimary} disabled={telegram.connecting}>
            Conectează
          </button>
        </form>
      )}

      {telegram.status === 'ready' && telegram.data && telegram.data.configured && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} disabled={telegram.testing} onClick={() => void sendTest()}>
            Mesaj de probă
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={telegram.disconnecting}
            onClick={() => void disconnect()}
          >
            Deconectează
          </button>
        </div>
      )}
    </Card>
  );
}

function TelegramStatus({ data }: { data: TelegramStatusView }) {
  if (!data.configured) return <p>Neconfigurat.</p>;
  return (
    <>
      <p>
        Conectat cu {data.chatName} prin @{data.botUsername} · ultimul rezumat: {formatDateTime(data.lastSuccess)}
      </p>
      {data.lastError && <p className={styles.error}>{data.lastError}</p>}
      {data.stale && (
        <p className={styles.error}>
          Rezumatul nu a mai fost trimis din {formatDateTime(data.lastSuccess)}. Verifică Jurnale\telegram.log; sarcina
          programată se reînregistrează la pornirea Startica.
        </p>
      )}
    </>
  );
}

function PreferencesSection() {
  const prefs = useNotificationPreferences();
  const toast = useToast();

  if (prefs.status === 'loading') return <p className={styles.notice}>Se încarcă preferințele…</p>;
  if (prefs.status === 'failed')
    return <p className={styles.error}>{prefs.failureMessage || 'Preferințele nu au putut fi încărcate.'}</p>;

  async function save() {
    try {
      await prefs.save();
      toast.show({ message: 'Preferințele au fost salvate.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <Card className={styles.panel}>
      <h3 className={styles.panelTitle}>Ce trimite rezumatul zilnic Telegram</h3>

      <div className={styles.settingsList}>
        <div className={styles.settingRow}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={prefs.values.birthdaysEnabled}
              onChange={event => prefs.setField('birthdaysEnabled', event.target.checked)}
            />
            <span>Zile de naștere</span>
          </label>
          <label className={styles.detailField}>
            Cu câte zile înainte
            <input
              type="number"
              min={0}
              max={14}
              step={1}
              value={prefs.values.birthdaysDaysBefore}
              onChange={event => prefs.setField('birthdaysDaysBefore', Number(event.target.value))}
            />
          </label>
        </div>

        <div className={styles.settingRow}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={prefs.values.visitsEnabled}
              onChange={event => prefs.setField('visitsEnabled', event.target.checked)}
            />
            <span>Vizite</span>
          </label>
          <label className={styles.detailField}>
            Orizont, în zile de la azi
            <input
              type="number"
              min={0}
              max={14}
              step={1}
              value={prefs.values.visitsHorizonDays}
              onChange={event => prefs.setField('visitsHorizonDays', Number(event.target.value))}
            />
          </label>
        </div>

        <div className={styles.settingRow}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={prefs.values.overdueEnabled}
              onChange={event => prefs.setField('overdueEnabled', event.target.checked)}
            />
            <span>Rest de plată</span>
          </label>
          <label className={styles.detailField}>
            Detalii
            <select
              value={prefs.values.overdueCadence}
              onChange={event =>
                prefs.setField('overdueCadence', event.target.value as typeof prefs.values.overdueCadence)
              }
            >
              <option value="daily">Zilnic</option>
              <option value="monday">Doar luni</option>
              <option value="never">Niciodată</option>
            </select>
          </label>
        </div>

        <div className={styles.settingRow}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={prefs.values.nothingToReportEnabled}
              onChange={event => prefs.setField('nothingToReportEnabled', event.target.checked)}
            />
            <span>Trimite și „Nimic de semnalat" într-o zi goală</span>
          </label>
        </div>

        <div className={styles.settingRow}>
          <label className={styles.detailField}>
            Ora rezumatului
            <input
              type="time"
              value={prefs.values.digestTime}
              onChange={event => prefs.setField('digestTime', event.target.value)}
            />
          </label>
          <p className={styles.hint}>
            Ora se aplică la următoarea pornire a Startica (sarcina programată se reînregistrează atunci).
          </p>
        </div>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Memento-uri Windows</legend>
        <div className={styles.settingsList}>
          <div className={styles.settingRow}>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={prefs.values.windowsVisitsTodayEnabled}
                onChange={event => prefs.setField('windowsVisitsTodayEnabled', event.target.checked)}
              />
              <span>Vizite azi</span>
            </label>
            <p className={styles.hint}>Cere fereastra Startica deschisă cât timp aplicația rulează.</p>
          </div>
          <div className={styles.settingRow}>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={prefs.values.windowsVisitSoonEnabled}
                onChange={event => prefs.setField('windowsVisitSoonEnabled', event.target.checked)}
              />
              <span>Vizită în curând</span>
            </label>
            <label className={styles.detailField}>
              Cu câte minute înainte
              <input
                type="number"
                min={5}
                max={120}
                step={5}
                value={prefs.values.windowsVisitSoonMinutes}
                onChange={event => prefs.setField('windowsVisitSoonMinutes', Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      </fieldset>

      {prefs.dirty && (
        <div className={styles.saveBar}>
          <p>Ai modificări nesalvate.</p>
          <button type="button" className={styles.btnPrimary} disabled={prefs.saving} onClick={() => void save()}>
            Salvează preferințele
          </button>
        </div>
      )}
    </Card>
  );
}
