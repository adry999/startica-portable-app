import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Field,
  FileInput,
  LoadingState,
  NumberInput,
  SegmentedControl,
  TextArea,
  TextInput,
  useToast,
} from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { usePinStatus } from '@shared/personal/usePinStatus';
import { useUiScale, type UiScale } from '@shared/state/ui-scale';
import {
  useKindergarten,
  type KindergartenSettings as KindergartenSettingsData,
  type ReceiptFormat,
} from './useKindergarten';
import backupStyles from './BackupPage.module.css';
import styles from './KindergartenSettings.module.css';
import { toUserError } from '@shared/api/to-user-error';

const RECEIPT_FORMAT_OPTIONS: { value: ReceiptFormat; label: string }[] = [
  { value: 'a5', label: 'A5' },
  { value: 'a4-third', label: 'A4 · 1/3 + 2/3' },
];

const UI_SCALE_OPTIONS: { value: UiScale; label: string }[] = [
  { value: 'compact', label: 'Compact 90%' },
  { value: 'normal', label: 'Normal 100%' },
  { value: 'large', label: 'Mare 110%' },
];

/** Câmpurile 1-2 (identitate, contact și plăți) — perechi [etichetă, cheie]. */
const IDENTITY_FIELDS: { label: string; key: keyof KindergartenSettingsData }[] = [
  { label: 'Denumire', key: 'name' },
  { label: 'Nume afișat', key: 'displayName' },
  { label: 'IDNO', key: 'idno' },
  { label: 'Administrator', key: 'administrator' },
];
const CONTACT_FIELDS: { label: string; key: keyof KindergartenSettingsData }[] = [
  { label: 'Adresă', key: 'address' },
  { label: 'Telefon', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Site', key: 'website' },
  { label: 'IBAN', key: 'iban' },
  { label: 'Banca', key: 'bank' },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function KindergartenSettings() {
  const kindergarten = useKindergarten();
  const toast = useToast();
  const [form, setForm] = useState<KindergartenSettingsData | null>(null);
  const [saving, setSaving] = useState(false);

  // Formularul se editează liber în memorie; se resincronizează cu ce a trimis serverul
  // fie la prima încărcare, fie după ce operatorul apasă „Renunță”.
  useEffect(() => {
    if (kindergarten.ready && kindergarten.settings && !form) setForm(kindergarten.settings);
  }, [kindergarten.ready, kindergarten.settings, form]);

  // 13b: nesalvat înseamnă că formularul diferă de ultimele date confirmate de server. Hook-ul
  // trebuie apelat necondiționat (înaintea ramurilor de mai jos), ca orice alt hook.
  const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(kindergarten.settings);
  useDirtyForm(dirty ? { label: 'o modificare la datele grădiniței', save } : null);

  if (kindergarten.status === 'failed')
    return (
      <div className={backupStyles.panel}>
        <p className={backupStyles.notice}>
          {kindergarten.failureMessage || 'Datele grădiniței nu au putut fi încărcate.'}
        </p>
        <Button type="button" variant="outline" onClick={() => void kindergarten.reload()}>
          Încearcă din nou
        </Button>
      </div>
    );
  if (!kindergarten.ready || !form) return <LoadingState />;

  function updateField(key: keyof KindergartenSettingsData, value: string | number) {
    setForm(current => (current ? { ...current, [key]: value } : current));
  }

  function discard() {
    setForm(kindergarten.settings);
  }

  async function save(): Promise<boolean> {
    if (!form) return false;
    setSaving(true);
    try {
      await kindergarten.save(form);
      toast.show({ message: 'Datele grădiniței au fost salvate.' });
      return true;
    } catch (error) {
      toast.show({ message: toUserError(error) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function changeLogo(file: File) {
    try {
      const logoDataUrl = await readFileAsDataUrl(file);
      updateField('logoDataUrl', logoDataUrl);
    } catch {
      toast.show({ message: 'Logo-ul nu a putut fi citit.' });
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>1 · Identitate</span>
          <div className={styles.logoRow}>
            <FileInput
              value={form.logoDataUrl || undefined}
              onSelect={file => void changeLogo(file)}
              onClear={() => updateField('logoDataUrl', '')}
              accept="image/*"
              ariaLabel="Logo grădiniță"
              placeholder={<span>{(form.displayName || form.name).charAt(0).toUpperCase() || 'G'}</span>}
            />
            <div className={styles.logoInfo}>
              <strong>Logo pe documente</strong>
              <p>SVG sau PNG, pe fundal transparent. Apare pe confirmări și rapoarte.</p>
            </div>
          </div>
          <div className={styles.fieldsGrid}>
            {IDENTITY_FIELDS.map(({ label, key }) => (
              <Field key={key} label={label} htmlFor={`kg-${key}`}>
                <TextInput
                  id={`kg-${key}`}
                  value={String(form[key] ?? '')}
                  onChange={value => updateField(key, value)}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>2 · Contact și plăți</span>
          <div className={styles.fieldsGrid}>
            {CONTACT_FIELDS.map(({ label, key }) => (
              <Field key={key} label={label} htmlFor={`kg-${key}`}>
                <TextInput
                  id={`kg-${key}`}
                  value={String(form[key] ?? '')}
                  onChange={value => updateField(key, value)}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>3 · Confirmări de plată</span>
          <div className={styles.fieldsGrid}>
            <Field label="Următorul număr" htmlFor="kg-next-receipt-number">
              <NumberInput
                id="kg-next-receipt-number"
                min={1}
                step={1}
                value={String(form.nextReceiptNumber)}
                onChange={value => updateField('nextReceiptNumber', Number(value))}
              />
            </Field>
            <Field label="Semnătură" htmlFor="kg-signature-label">
              <TextInput
                id="kg-signature-label"
                value={form.signatureLabel}
                onChange={value => updateField('signatureLabel', value)}
                placeholder="ex. Administrator: Ciobanu Maria"
              />
            </Field>
          </div>
          <Field label="Mențiune în subsol" htmlFor="kg-footer-note">
            <TextArea
              id="kg-footer-note"
              value={form.footerNote}
              onChange={value => updateField('footerNote', value)}
              placeholder="Document intern de confirmare a plății. Nu ține locul bonului fiscal."
            />
          </Field>
          <div className={styles.field}>
            Format
            <SegmentedControl
              ariaLabel="Formatul confirmării de plată"
              value={form.receiptFormat}
              onChange={value => updateField('receiptFormat', value)}
              options={RECEIPT_FORMAT_OPTIONS}
            />
          </div>
        </Card>

        <AdminPinCard />
        <UiScaleCard />
      </div>

      <div className={styles.right}>
        <span className={styles.sectionLabel}>Cum apare pe documente</span>
        <Card className={styles.previewCard}>
          <div className={styles.previewHead}>
            {form.logoDataUrl && <img src={form.logoDataUrl} alt="" className={styles.previewLogo} />}
            <div className={styles.previewInfo}>
              <strong>{form.displayName || form.name || 'Denumirea grădiniței'}</strong>
              {form.idno && <span>IDNO {form.idno}</span>}
              {form.address && <span>{form.address}</span>}
              {form.phone && <span>{form.phone}</span>}
            </div>
          </div>
          <div className={styles.previewBody}>
            <span style={{ width: '60%' }} />
            <span style={{ width: '85%' }} />
            <span style={{ width: '40%' }} />
          </div>
          <p className={styles.previewFooter}>
            {form.footerNote || 'Document intern de confirmare a plății. Nu ține locul bonului fiscal.'}
          </p>
        </Card>
        <div className={styles.previewActions}>
          <Button variant="white" onClick={discard} disabled={saving}>
            Renunță
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            Salvează datele
          </Button>
        </div>
      </div>
    </div>
  );
}

/** „PIN administrator” (24-personal.md, decizia 8) — nu e securitate, doar oprește o privire din mers. */
function AdminPinCard() {
  const pin = usePinStatus();
  const toast = useToast();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);

  if (pin.status === 'loading') return <LoadingState />;

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const outcome = await pin.set(newPin, pin.configured ? currentPin : undefined);
      if (outcome.ok) {
        toast.show({ message: pin.configured ? 'PIN-ul a fost schimbat.' : 'PIN administrator setat.' });
        setCurrentPin('');
        setNewPin('');
      } else {
        toast.show({ message: outcome.message });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={backupStyles.panel}>
      <span className={styles.sectionLabel}>4 · PIN administrator</span>
      <p className={styles.notice}>
        PIN-ul protejează doar ecranul Salarii de o privire din mers — oricine are acces la calculator poate deschide
        fișierul bazei de date sau o copie de siguranță și citi salariile. Nu ține loc de cont de utilizator sau
        criptare.
      </p>
      <form
        className={styles.fieldsGrid}
        autoComplete="off"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        {pin.configured && (
          <Field label="PIN curent" htmlFor="kg-pin-current">
            <TextInput
              id="kg-pin-current"
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={setCurrentPin}
            />
          </Field>
        )}
        <Field label={pin.configured ? 'PIN nou' : 'Setează PIN (4–6 cifre)'} htmlFor="kg-pin-new">
          <TextInput id="kg-pin-new" type="password" inputMode="numeric" value={newPin} onChange={setNewPin} />
        </Field>
        <Button type="submit" disabled={saving || newPin.length < 4}>
          {pin.configured ? 'Schimbă PIN-ul' : 'Setează PIN-ul'}
        </Button>
      </form>
    </Card>
  );
}

/** Mărimea interfeței (FEEDBACK.md #6) — preferință per calculator, nu se salvează în /api/kindergarten. */
function UiScaleCard() {
  const { scale, setScale } = useUiScale();

  return (
    <Card className={backupStyles.panel}>
      <span className={styles.sectionLabel}>5 · Interfață</span>
      <div className={styles.field}>
        Mărimea interfeței
        <SegmentedControl ariaLabel="Mărimea interfeței" value={scale} onChange={setScale} options={UI_SCALE_OPTIONS} />
      </div>
      <p className={styles.notice}>
        Se ține minte doar pe acest calculator. Tipăriturile (ex. Pontaj) rămân la mărimea reală, indiferent de această
        setare.
      </p>
    </Card>
  );
}
