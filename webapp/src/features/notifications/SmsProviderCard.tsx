import { useEffect, useState } from 'react';
import { Badge, Button, Card, Checkbox, NumberInput, PhoneInput, TextInput, useToast } from '@shared/ui';
import { useSmsStatus } from '@shared/sms';
import { formatMoney } from '#shared/format/money-format.mjs';
import styles from './SmsProviderCard.module.css';
import notificationsStyles from './NotificationsPage.module.css';
import { toUserError } from '@shared/api/to-user-error';

const MONTHLY_LIMIT_MAX = 5000;
const TEST_SMS_COST_LEI = 0.3;

/** Card „Furnizor SMS" din Notificări → Șabloane (docs/design/screens/14-sms.md §11b). */
export function SmsProviderCard() {
  const sms = useSmsStatus();
  const toast = useToast();
  const [sender, setSender] = useState('');
  const [token, setToken] = useState('');
  // Derivat direct din sms.data (nu sincronizat printr-un efect): un efect ar întârzia
  // un ciclu de randare față de badge-ul „Conectat" (același sms.data), și ar lăsa
  // o fereastră scurtă în care cheia mascată nu e încă randată sub sarcină de test.
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [limitValue, setLimitValue] = useState(500);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    if (!sms.data) return;
    setSender(sms.data.sender);
    setLimitEnabled(sms.data.monthlyLimit !== null);
    if (sms.data.monthlyLimit !== null) setLimitValue(sms.data.monthlyLimit);
  }, [sms.data]);

  const showTokenField = tokenRevealed || !(sms.data?.configured ?? false);

  if (sms.status === 'loading') return <Card className={notificationsStyles.panel}>Se încarcă furnizorul SMS…</Card>;

  async function save() {
    try {
      await sms.connect({
        token: token || undefined,
        sender,
        monthlyLimit: limitEnabled ? Math.min(MONTHLY_LIMIT_MAX, Math.max(1, limitValue)) : null,
      });
      setToken('');
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function confirmTest() {
    try {
      await sms.sendTest(testPhone);
      setTesting(false);
      setTestPhone('');
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function disconnect() {
    try {
      await sms.disconnect();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  const configured = sms.data?.configured ?? false;
  const limitPercent =
    limitEnabled && sms.data?.monthlyLimit ? Math.min(100, (sms.data.sentThisMonth / sms.data.monthlyLimit) * 100) : 0;
  const barTone = limitPercent >= 100 ? styles.full : limitPercent >= 80 ? styles.warn : '';

  return (
    <Card className={`${notificationsStyles.panel} ${styles.card}`}>
      <div className={styles.header}>
        <h3 className={notificationsStyles.panelTitle}>Furnizor SMS</h3>
        <Badge tone={configured ? 'mint' : 'neutral'}>{configured ? 'Conectat' : 'Neconectat'}</Badge>
      </div>

      <p className={styles.service}>Serviciu: sms.md</p>

      <div className={notificationsStyles.field}>
        <label htmlFor="sms-provider-sender">Expeditor</label>
        <TextInput id="sms-provider-sender" value={sender} maxLength={15} onChange={setSender} />
        <p className={notificationsStyles.hint}>Numele aprobat în dashboard-ul sms.md.</p>
      </div>

      {showTokenField ? (
        <div className={notificationsStyles.field}>
          <label htmlFor="sms-provider-token">Cheie API</label>
          <TextInput id="sms-provider-token" type="password" autoComplete="off" value={token} onChange={setToken} />
          <p className={notificationsStyles.hint}>
            Cheia trebuie să aibă drepturile: trimitere SMS, citire status mesaj, sold cont, expeditori activi.
          </p>
        </div>
      ) : (
        <div className={notificationsStyles.field}>
          Cheie API
          <span>{sms.data?.tokenMasked}</span>
          <Button type="button" variant="ghost" onClick={() => setTokenRevealed(true)}>
            Schimbă
          </Button>
        </div>
      )}

      <div className={notificationsStyles.toggleField}>
        <Checkbox checked={limitEnabled} onChange={setLimitEnabled} ariaLabel="Activează limita lunară" />
        <span>Activează limita lunară</span>
      </div>
      {limitEnabled && (
        <label className={notificationsStyles.detailField}>
          Limită lunară
          <NumberInput
            className={notificationsStyles.compactNumber}
            min={1}
            max={MONTHLY_LIMIT_MAX}
            value={String(limitValue)}
            onChange={value => setLimitValue(Number(value))}
          />
        </label>
      )}

      <p className={styles.counterLine}>
        {sms.data?.sentThisMonth ?? 0} trimise luna aceasta · {sms.data?.segmentsThisMonth ?? 0} segmente
      </p>
      {limitEnabled && sms.data?.monthlyLimit && (
        <div className={styles.limitBar}>
          <div className={`${styles.limitBarFill} ${barTone}`} style={{ width: `${limitPercent}%` }} />
        </div>
      )}
      {limitEnabled && sms.data?.monthlyLimit && (
        <p className={styles.counterLine}>
          {sms.data.sentThisMonth} / {sms.data.monthlyLimit}
        </p>
      )}

      <p className={styles.balance}>Sold sms.md: {sms.data?.balance ? formatMoney(Number(sms.data.balance)) : '—'}</p>

      {sms.data?.lastError && <p className={notificationsStyles.error}>{sms.data.lastError}</p>}

      <div className={notificationsStyles.toolbar}>
        <Button type="button" variant="primary" disabled={sms.connecting} onClick={() => void save()}>
          {configured ? 'Salvează' : 'Conectează'}
        </Button>
        {configured && (
          <>
            <Button type="button" variant="ghost" onClick={() => setTesting(true)}>
              Trimite SMS de test
            </Button>
            <Button type="button" variant="ghost" disabled={sms.disconnecting} onClick={() => void disconnect()}>
              Deconectează
            </Button>
          </>
        )}
      </div>

      {testing && (
        <div className={styles.testRow}>
          <label className={notificationsStyles.field}>
            Telefon pentru test
            <PhoneInput value={testPhone} onChange={setTestPhone} placeholder="069123456" />
          </label>
          <Button type="button" variant="ghost" onClick={() => void confirmTest()}>
            Trimite — costă 1 SMS (≈ {formatMoney(TEST_SMS_COST_LEI)})
          </Button>
        </div>
      )}
    </Card>
  );
}
