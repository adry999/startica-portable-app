import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  SearchSelect,
  SegmentedControl,
  TextArea,
  TextField,
  type SearchSelectOption,
} from '@shared/ui';
import { useSmsSend, useSmsTemplates, SmsSegmentCounter, type SmsSendResultView } from '@shared/sms';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Staff } from '@shared/personal/personal.types';
import { useAppSession } from '@shared/api/session';
import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { renderSmsTemplate } from '@domain/sms-template.mjs';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './SmsNewMessageDialog.module.css';

type RecipientMode = 'app' | 'other';
type BodyMode = 'template' | 'free';

export interface SmsNewMessageDialogProps {
  open: boolean;
  unitCostLei: number;
  onClose: () => void;
  onSent: (result: SmsSendResultView) => void;
}

interface ResolvedRecipient {
  name: string;
  phone: string;
  childName: string;
}

/** Părinții (din copii, cu telefon) + angajații activi (cu telefon) — sursa „Din aplicație" (11c). */
function appRecipientOptions(children: Child[], staff: Staff[]): SearchSelectOption[] {
  const options: SearchSelectOption[] = [];
  for (const child of children) {
    if (child.archived) continue;
    if (child.parent && child.phone)
      options.push({ value: `child:${child.id}:1`, label: `${child.parent} — părinte (${child.name})` });
    if (child.parent2 && child.phone2)
      options.push({ value: `child:${child.id}:2`, label: `${child.parent2} — părinte (${child.name})` });
  }
  for (const person of staff) {
    if (person.archivedAt || !person.phone) continue;
    options.push({ value: `staff:${person.id}`, label: `${person.name} — angajat` });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'ro'));
}

function resolveAppRecipient(
  value: string,
  children: Child[],
  staffById: ReadonlyMap<string, Staff>,
): ResolvedRecipient | null {
  const [kind, id, slot] = value.split(':');
  if (kind === 'child') {
    const child = children.find(candidate => candidate.id === id);
    if (!child) return null;
    return slot === '2'
      ? { name: child.parent2 ?? '', phone: child.phone2 ?? '', childName: child.name }
      : { name: child.parent, phone: child.phone, childName: child.name };
  }
  if (kind === 'staff') {
    const person = staffById.get(id);
    if (!person) return null;
    return { name: person.name, phone: person.phone, childName: '' };
  }
  return null;
}

// Doar variabilele care au sens pentru un destinatar arbitrar — celelalte ({luna}, {taxa}…)
// rămân vizibile în text, ca operatorul să vadă că șablonul nu se potrivește perfect.
function templateVariablesFor(recipientName: string, childName: string): Record<string, string> {
  const variables: Record<string, string> = {};
  if (recipientName) variables['părinte'] = recipientName;
  if (childName) variables['copil'] = childName;
  return variables;
}

/** „+ SMS nou" (11c/11d): destinatar din aplicație sau alt număr, șablon sau text liber. */
export function SmsNewMessageDialog({ open, unitCostLei, onClose, onSent }: SmsNewMessageDialogProps) {
  const session = useAppSession();
  const personal = usePersonal();
  const templatesData = useSmsTemplates();
  const smsSend = useSmsSend();

  const [recipientMode, setRecipientMode] = useState<RecipientMode>('app');
  const [appRecipientValue, setAppRecipientValue] = useState('');
  const [otherName, setOtherName] = useState('');
  const [otherPhone, setOtherPhone] = useState('');
  const [bodyMode, setBodyMode] = useState<BodyMode>('template');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<SmsSendResultView | null>(null);

  const records = session.state.state as RecordsSnapshot;
  const staffById = useMemo(() => new Map(personal.staff.map(person => [person.id, person])), [personal.staff]);
  const appOptions = useMemo(
    () => appRecipientOptions(records.children, personal.staff),
    [records.children, personal.staff],
  );

  function reset() {
    setRecipientMode('app');
    setAppRecipientValue('');
    setOtherName('');
    setOtherPhone('');
    setBodyMode('template');
    setTemplateId(null);
    setFreeText('');
    setSaveAsTemplate(false);
    setNewTemplateName('');
    setErrorMessage('');
    setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  if (!open) return null;

  const resolvedApp =
    recipientMode === 'app' ? resolveAppRecipient(appRecipientValue, records.children, staffById) : null;
  const recipientName = recipientMode === 'app' ? (resolvedApp?.name ?? '') : otherName;
  const rawPhone = recipientMode === 'app' ? (resolvedApp?.phone ?? '') : otherPhone;
  const childName = recipientMode === 'app' ? (resolvedApp?.childName ?? '') : '';
  const normalizedPhone = normalizeMoldovanPhone(rawPhone);
  const phoneInvalid = rawPhone.trim() !== '' && !normalizedPhone;
  const appRecipientInvalid = recipientMode === 'app' && appRecipientValue !== '' && !normalizedPhone;

  const selectedTemplate = templatesData.templates.find(candidate => candidate.id === templateId) ?? null;
  const finalText =
    bodyMode === 'free'
      ? freeText
      : selectedTemplate
        ? renderSmsTemplate(selectedTemplate.body, templateVariablesFor(recipientName, childName))
        : '';

  const sendDisabled =
    sending ||
    !recipientName.trim() ||
    !normalizedPhone ||
    !finalText.trim() ||
    (bodyMode === 'template' && !selectedTemplate);

  async function send() {
    if (!normalizedPhone) return;
    setErrorMessage('');
    setSending(true);
    try {
      const sendResult = await smsSend.send({
        source: 'manual',
        month: null,
        templateId: bodyMode === 'template' ? templateId : null,
        messages: [
          {
            childId: null,
            childName,
            recipientName: recipientName.trim(),
            phone: normalizedPhone,
            text: finalText,
          },
        ],
      });
      setResult(sendResult);
      const sent = sendResult.results.some(outcome => outcome.outcome === 'sent');
      if (sent && saveAsTemplate && newTemplateName.trim())
        await templatesData.save({
          name: newTemplateName.trim(),
          body: freeText,
          stripDiacritics: true,
          isDefault: false,
        });
      if (sent) onSent(sendResult);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  const sentCount = result?.results.filter(outcome => outcome.outcome === 'sent').length ?? 0;

  return (
    <Drawer
      open={open}
      title="SMS nou"
      size="detail"
      onClose={close}
      footer={
        !result ? (
          <>
            <Button variant="ghost" onClick={close}>
              Anulează
            </Button>
            <Button variant="primary" disabled={sendDisabled} onClick={() => void send()}>
              Trimite SMS
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={close}>
            Închide
          </Button>
        )
      }
    >
      <div className={styles.field}>
        <span className={styles.label}>Destinatar</span>
        <SegmentedControl
          ariaLabel="Sursa destinatarului"
          value={recipientMode}
          onChange={setRecipientMode}
          options={[
            { value: 'app', label: 'Din aplicație' },
            { value: 'other', label: 'Alt număr' },
          ]}
        />
      </div>

      {recipientMode === 'app' ? (
        <label className={styles.field}>
          Persoană
          <SearchSelect
            options={appOptions}
            value={appRecipientValue}
            onChange={setAppRecipientValue}
            ariaLabel="Alege persoana"
            placeholder="Caută un părinte sau angajat…"
          />
          {appRecipientInvalid && <span className={styles.error}>Această persoană nu are un telefon valid.</span>}
        </label>
      ) : (
        <>
          <label className={styles.field}>
            Nume
            <TextField
              value={otherName}
              onChange={setOtherName}
              placeholder="Nume destinatar"
              ariaLabel="Nume destinatar"
            />
          </label>
          <label className={styles.field}>
            Telefon
            <TextField
              type="tel"
              value={otherPhone}
              onChange={setOtherPhone}
              placeholder="069123456"
              ariaLabel="Telefon destinatar"
              invalid={phoneInvalid}
            />
            {phoneInvalid && <span className={styles.error}>Telefonul nu e un număr mobil moldovenesc valid.</span>}
          </label>
        </>
      )}

      <div className={styles.field}>
        <span className={styles.label}>Mesaj</span>
        <SegmentedControl
          ariaLabel="Tip mesaj"
          value={bodyMode}
          onChange={setBodyMode}
          options={[
            { value: 'template', label: 'Șablon' },
            { value: 'free', label: 'Text liber' },
          ]}
        />
      </div>

      {bodyMode === 'template' ? (
        <label className={styles.field}>
          Șablon
          <SearchSelect
            options={templatesData.templates.map(candidate => ({ value: candidate.id, label: candidate.name }))}
            value={templateId ?? ''}
            onChange={value => setTemplateId(value || null)}
            ariaLabel="Alege șablonul"
            placeholder="Alege un șablon…"
          />
        </label>
      ) : (
        <label className={styles.field}>
          Text
          <TextArea
            value={freeText}
            onChange={setFreeText}
            placeholder="Scrie mesajul…"
            ariaLabel="Text mesaj"
            rows={5}
          />
        </label>
      )}

      {finalText.trim() !== '' && (
        <div className={styles.field}>
          <p className={styles.preview}>{finalText}</p>
          <SmsSegmentCounter text={finalText} unitCost={unitCostLei} />
        </div>
      )}

      {bodyMode === 'free' && (
        <div className={styles.saveTemplateRow}>
          <Checkbox checked={saveAsTemplate} onChange={setSaveAsTemplate} ariaLabel="Salvează ca șablon nou" />
          <span>Salvează ca șablon nou</span>
          {saveAsTemplate && (
            <TextField
              value={newTemplateName}
              onChange={setNewTemplateName}
              placeholder="Nume șablon"
              ariaLabel="Nume șablon nou"
            />
          )}
        </div>
      )}

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      {result && (
        <p className={styles.resultSummary}>
          {sentCount > 0 ? 'SMS trimis.' : `Trimiterea a eșuat${result.stopped ? `: ${result.stopped.message}` : '.'}`}
        </p>
      )}
    </Drawer>
  );
}
