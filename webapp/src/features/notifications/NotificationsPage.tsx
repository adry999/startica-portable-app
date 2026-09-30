import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  Card,
  Checkbox,
  LoadingState,
  NumberInput,
  Select,
  SegmentedControl,
  TextInput,
  Toggle,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useTelegramStatus, type TelegramStatusData, type TelegramStatusView } from './useTelegramStatus';
import { useNotificationPreferences } from './useNotificationPreferences';
import { SmsMessagesPanel } from './SmsMessagesPanel';
import { SmsTemplatesPanel } from './SmsTemplatesPanel';
import styles from './NotificationsPage.module.css';

type NotificationsTab = 'canale' | 'mesaje' | 'sabloane';

const TAB_OPTIONS: { value: NotificationsTab; label: string }[] = [
  { value: 'canale', label: 'Canale' },
  { value: 'mesaje', label: 'Mesaje SMS' },
  { value: 'sabloane', label: 'Șabloane' },
];

export function NotificationsPage() {
  const [tab, setTab] = usePersistedState<NotificationsTab>('notifications.tab', 'canale');
  const telegram = useTelegramStatus();
  const toast = useToast();

  async function sendTest() {
    try {
      await telegram.sendTest();
      toast.show({ message: 'Mesaj de probă trimis.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  useTopbarActions(
    <>
      <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} ariaLabel="Filă Notificări" />
      {tab === 'canale' && telegram.status === 'ready' && telegram.data?.configured && (
        <Button variant="outline" disabled={telegram.testing} onClick={() => void sendTest()}>
          Trimite un mesaj de test
        </Button>
      )}
    </>,
  );

  return (
    <>
      {tab === 'canale' && (
        <div className={styles.channelsLayout}>
          <TelegramSection telegram={telegram} />
          <PreferencesSection />
        </div>
      )}
      {tab === 'mesaje' && <SmsMessagesPanel />}
      {tab === 'sabloane' && <SmsTemplatesPanel />}
    </>
  );
}

function TelegramSection({ telegram }: { telegram: TelegramStatusData }) {
  const toast = useToast();
  // „Schimbă contul” redeschide formularul de token peste cardul deja conectat, fără să
  // deconecteze botul curent — se închide singur după un connect() reușit.
  const [changingAccount, setChangingAccount] = useState(false);

  async function connect(event: FormEvent) {
    event.preventDefault();
    try {
      await telegram.connect();
      setChangingAccount(false);
      toast.show({ message: 'Bot conectat. Ai primit un mesaj de probă în Telegram.' });
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

  if (telegram.status === 'loading') return <LoadingState />;
  if (telegram.status === 'failed') return <p className={styles.error}>{telegram.failureMessage}</p>;

  const data = telegram.data;
  const showForm = !data?.configured || changingAccount;

  return (
    <Card tone="mint" decorative className={styles.telegramCard}>
      <span className={styles.telegramEyebrow}>Telegram</span>
      <h3 className={styles.telegramTitle}>
        {data?.configured ? `Conectat la @${data.botUsername}` : 'Conectează Telegram'}
      </h3>

      {data?.configured && !changingAccount && <TelegramStatus data={data} />}

      {data?.configured && !changingAccount && (
        <div className={styles.telegramActions}>
          <Button variant="white" onClick={() => setChangingAccount(true)}>
            Schimbă contul
          </Button>
          <Button
            variant="ghost"
            className={styles.disconnectButton}
            disabled={telegram.disconnecting}
            onClick={() => void disconnect()}
          >
            Deconectează
          </Button>
        </div>
      )}

      {showForm && (
        <form className={styles.form} onSubmit={event => void connect(event)}>
          <label className={styles.field}>
            Token-ul botului
            <TextInput
              type="password"
              autoComplete="off"
              ariaLabel="Token-ul botului"
              placeholder="123456789:AAH…"
              value={telegram.tokenInput}
              onChange={telegram.setTokenInput}
            />
          </label>
          <p className={styles.hint}>
            Pentru o singură persoană: deschide botul, apasă Start. Pentru mai multe persoane: adaugă botul într-un grup
            Telegram și scrie acolo „/start@NumeleBotului".
          </p>
          <div className={styles.telegramActions}>
            <Button type="submit" variant="white" disabled={telegram.connecting}>
              Conectează
            </Button>
            {changingAccount && (
              <Button
                type="button"
                variant="ghost"
                className={styles.disconnectButton}
                onClick={() => setChangingAccount(false)}
              >
                Renunță
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function TelegramStatus({ data }: { data: TelegramStatusView }) {
  return (
    <>
      <p className={styles.telegramText}>
        Mesajele ajung pe telefonul administratorului. Ultimul mesaj: {formatDateTime(data.lastSuccess)}.
      </p>
      {data.lastError && <p className={styles.telegramWarning}>{data.lastError}</p>}
      {data.stale && (
        <p className={styles.telegramWarning}>
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

  if (prefs.status === 'loading') return <LoadingState />;
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

      <div className={styles.toggleList}>
        <ToggleRow
          name="Restanțe"
          description="Copiii cu restanță la plată, cu detaliile de mai jos."
          checked={prefs.values.overdueEnabled}
          onChange={value => prefs.setField('overdueEnabled', value)}
        >
          <Select
            ariaLabel="Detalii restanțe"
            value={prefs.values.overdueCadence}
            onChange={value => prefs.setField('overdueCadence', value as typeof prefs.values.overdueCadence)}
            options={[
              { value: 'daily', label: 'Zilnic' },
              { value: 'monday', label: 'Doar luni' },
              { value: 'never', label: 'Niciodată' },
            ]}
          />
        </ToggleRow>

        <ToggleRow
          name="Zile de naștere"
          description="Copiii care împlinesc ani, cu atâtea zile înainte."
          checked={prefs.values.birthdaysEnabled}
          onChange={value => prefs.setField('birthdaysEnabled', value)}
        >
          <label className={styles.detailField}>
            cu
            <NumberInput
              className={styles.compactNumber}
              ariaLabel="Cu câte zile înainte"
              min={0}
              max={14}
              step={1}
              value={String(prefs.values.birthdaysDaysBefore)}
              onChange={value => prefs.setField('birthdaysDaysBefore', Number(value))}
            />
            zile înainte
          </label>
        </ToggleRow>

        <ToggleRow
          name="Vizite programate"
          description="Vizitele din următoarele zile, ca să nu fie uitate."
          checked={prefs.values.visitsEnabled}
          onChange={value => prefs.setField('visitsEnabled', value)}
        >
          <label className={styles.detailField}>
            orizont
            <NumberInput
              className={styles.compactNumber}
              ariaLabel="Orizont, în zile de la azi"
              min={0}
              max={14}
              step={1}
              value={String(prefs.values.visitsHorizonDays)}
              onChange={value => prefs.setField('visitsHorizonDays', Number(value))}
            />
            zile
          </label>
        </ToggleRow>
      </div>

      {/* N-4 [decizie]: „Nimic de semnalat” și ora rezumatului sunt funcții reale fără loc în
          artboard-ul 10b — rămân, dar pliate sub un „Detalii”, ca lista principală să arate ca spec-ul. */}
      <details className={styles.details}>
        <summary className={styles.detailsSummary}>Detalii</summary>
        <div className={styles.settingsList}>
          <div className={styles.settingRow}>
            <div className={styles.toggleField}>
              <Checkbox
                checked={prefs.values.nothingToReportEnabled}
                onChange={value => prefs.setField('nothingToReportEnabled', value)}
                ariaLabel="Trimite și „Nimic de semnalat” într-o zi goală"
              />
              <span>Trimite și „Nimic de semnalat" într-o zi goală</span>
            </div>
          </div>

          <div className={styles.settingRow}>
            {/* type="time" rămâne brut — nu există încă un `TimeInput` în @shared/ui
                (la fel ca în VisitFormDrawer/PoolSettings). */}
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
              <div className={styles.toggleField}>
                <Checkbox
                  checked={prefs.values.windowsVisitsTodayEnabled}
                  onChange={value => prefs.setField('windowsVisitsTodayEnabled', value)}
                  ariaLabel="Vizite azi"
                />
                <span>Vizite azi</span>
              </div>
              <p className={styles.hint}>Cere fereastra Startica deschisă cât timp aplicația rulează.</p>
            </div>
            <div className={styles.settingRow}>
              <div className={styles.toggleField}>
                <Checkbox
                  checked={prefs.values.windowsVisitSoonEnabled}
                  onChange={value => prefs.setField('windowsVisitSoonEnabled', value)}
                  ariaLabel="Vizită în curând"
                />
                <span>Vizită în curând</span>
              </div>
              <label className={styles.detailField}>
                Cu câte minute înainte
                <NumberInput
                  className={styles.compactNumber}
                  ariaLabel="Cu câte minute înainte"
                  min={5}
                  max={120}
                  step={5}
                  value={String(prefs.values.windowsVisitSoonMinutes)}
                  onChange={value => prefs.setField('windowsVisitSoonMinutes', Number(value))}
                />
              </label>
            </div>
          </div>
        </fieldset>
      </details>

      {prefs.dirty && (
        <div className={styles.saveBar}>
          <p>Ai modificări nesalvate.</p>
          <Button disabled={prefs.saving} onClick={() => void save()}>
            Salvează preferințele
          </Button>
        </div>
      )}
    </Card>
  );
}

function ToggleRow({
  name,
  description,
  checked,
  onChange,
  children,
}: {
  name: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <span className={styles.toggleName}>{name}</span>
        <span className={styles.toggleDescription}>{description}</span>
      </div>
      {checked && <div className={styles.toggleDetail}>{children}</div>}
      <Toggle checked={checked} onChange={onChange} ariaLabel={name} />
    </div>
  );
}
