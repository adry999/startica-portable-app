import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Card, SegmentedControl, useToast } from '@shared/ui';
import {
  useKindergarten,
  type KindergartenSettings as KindergartenSettingsData,
  type ReceiptFormat,
} from './useKindergarten';
import backupStyles from './BackupPage.module.css';
import styles from './KindergartenSettings.module.css';

const RECEIPT_FORMAT_OPTIONS: { value: ReceiptFormat; label: string }[] = [
  { value: 'a5', label: 'A5' },
  { value: 'a4-third', label: 'A4 · 1/3 + 2/3' },
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
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Formularul se editează liber în memorie; se resincronizează cu ce a trimis serverul
  // fie la prima încărcare, fie după ce operatorul apasă „Renunță”.
  useEffect(() => {
    if (kindergarten.ready && kindergarten.settings && !form) setForm(kindergarten.settings);
  }, [kindergarten.ready, kindergarten.settings, form]);

  if (!kindergarten.ready || !form) return <p className={backupStyles.notice}>Se încarcă datele grădiniței…</p>;

  function updateField(key: keyof KindergartenSettingsData, value: string | number) {
    setForm(current => (current ? { ...current, [key]: value } : current));
  }

  function discard() {
    setForm(kindergarten.settings);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await kindergarten.save(form);
      toast.show({ message: 'Datele grădiniței au fost salvate.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function changeLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const logoDataUrl = await readFileAsDataUrl(file);
      updateField('logoDataUrl', logoDataUrl);
    } catch {
      toast.show({ message: 'Logo-ul nu a putut fi citit.' });
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>1 · Identitate</span>
          <div className={styles.logoRow}>
            <div className={styles.logoBox} style={{ background: form.logoDataUrl ? undefined : 'var(--orange-soft)' }}>
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Logo" />
              ) : (
                (form.displayName || form.name).charAt(0).toUpperCase() || 'G'
              )}
            </div>
            <div className={styles.logoInfo}>
              <strong>Logo pe documente</strong>
              <p>SVG sau PNG, pe fundal transparent. Apare pe confirmări și rapoarte.</p>
              <div className={styles.logoActions}>
                <Button variant="outline" onClick={() => logoInputRef.current?.click()}>
                  Schimbă
                </Button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={event => void changeLogo(event)}
                />
                {form.logoDataUrl && (
                  <button type="button" className={styles.removeLogo} onClick={() => updateField('logoDataUrl', '')}>
                    Șterge logo-ul
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className={styles.fieldsGrid}>
            {IDENTITY_FIELDS.map(({ label, key }) => (
              <label key={key} className={styles.field}>
                {label}
                <input value={String(form[key] ?? '')} onChange={event => updateField(key, event.target.value)} />
              </label>
            ))}
          </div>
        </Card>

        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>2 · Contact și plăți</span>
          <div className={styles.fieldsGrid}>
            {CONTACT_FIELDS.map(({ label, key }) => (
              <label key={key} className={styles.field}>
                {label}
                <input value={String(form[key] ?? '')} onChange={event => updateField(key, event.target.value)} />
              </label>
            ))}
          </div>
        </Card>

        <Card className={backupStyles.panel}>
          <span className={styles.sectionLabel}>3 · Confirmări de plată</span>
          <div className={styles.fieldsGrid}>
            <label className={styles.field}>
              Următorul număr
              <input
                type="number"
                min={1}
                step={1}
                value={form.nextReceiptNumber}
                onChange={event => updateField('nextReceiptNumber', Number(event.target.value))}
              />
            </label>
            <label className={styles.field}>
              Semnătură
              <input
                value={form.signatureLabel}
                onChange={event => updateField('signatureLabel', event.target.value)}
                placeholder="ex. Administrator: Ciobanu Maria"
              />
            </label>
          </div>
          <label className={styles.field}>
            Mențiune în subsol
            <textarea
              value={form.footerNote}
              onChange={event => updateField('footerNote', event.target.value)}
              placeholder="Document intern de confirmare a plății. Nu ține locul bonului fiscal."
            />
          </label>
          <label className={styles.field}>
            Format
            <SegmentedControl
              ariaLabel="Formatul confirmării de plată"
              value={form.receiptFormat}
              onChange={value => updateField('receiptFormat', value)}
              options={RECEIPT_FORMAT_OPTIONS}
            />
          </label>
        </Card>
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
