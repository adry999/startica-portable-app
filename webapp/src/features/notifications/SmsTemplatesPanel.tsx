import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Checkbox, ConfirmDeleteDialog, TextArea, TextInput, useToast } from '@shared/ui';
import { useSmsTemplates, SmsSegmentCounter, type SmsTemplateView } from '@shared/sms';
import { finalizeSmsText } from '#features/sms-notify/index.web.mjs';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { renderSmsTemplate, smsVariablesFor, SMS_TEMPLATE_VARIABLES } from '@domain/sms-template.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import { SmsProviderCard } from './SmsProviderCard';
import notificationsStyles from './NotificationsPage.module.css';
import styles from './SmsTemplatesPanel.module.css';

// Date de exemplu (spec 14-sms.md §11b), folosite doar când nu există niciun restanțier real.
const SAMPLE_VARIABLES: Record<string, string> = {
  părinte: 'Maria',
  copil: 'Ion',
  luna: 'septembrie',
  taxa: '1 500,00 lei',
  rest: '500,00 lei',
  achitat: '1 000,00 lei',
  zi: '05.09.2026',
};

function blankDraft() {
  return { name: '', body: '', stripDiacritics: true, isDefault: false };
}

/** Fila „Șabloane" din Notificări: listă + editor + card Furnizor SMS (docs/design/screens/14-sms.md §11b). */
export function SmsTemplatesPanel() {
  const templatesData = useSmsTemplates();
  const session = useAppSession();
  const { rates } = useExchangeRates();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blankDraft());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (templatesData.status !== 'ready' || selectedId !== null || templatesData.templates.length === 0) return;
    const initial = templatesData.defaultTemplate ?? templatesData.templates[0];
    selectTemplate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesData.status]);

  function selectTemplate(template: SmsTemplateView) {
    setSelectedId(template.id);
    setDraft({
      name: template.name,
      body: template.body,
      stripDiacritics: template.stripDiacritics,
      isDefault: template.isDefault,
    });
  }

  function startNewTemplate() {
    setSelectedId(null);
    setDraft(blankDraft());
  }

  function discard() {
    const current = templatesData.templates.find(template => template.id === selectedId);
    setDraft(current ? { ...current } : blankDraft());
  }

  function insertVariable(name: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? draft.body.length;
    const end = el?.selectionEnd ?? draft.body.length;
    const next = `${draft.body.slice(0, start)}{${name}}${draft.body.slice(end)}`;
    setDraft(current => ({ ...current, body: next }));
  }

  async function save() {
    try {
      const saved = await templatesData.save({ id: selectedId ?? undefined, ...draft });
      setSelectedId(saved.id);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function confirmDelete() {
    if (!selectedId) return;
    setConfirmingDelete(false);
    try {
      await templatesData.remove(selectedId);
      setSelectedId(null);
      setDraft(blankDraft());
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const todayStr = todayFn();
  const month = todayStr.slice(0, 7);
  let previewVariables = SAMPLE_VARIABLES;
  if (session.state.ready) {
    const records = session.state.state as RecordsSnapshot;
    const notified = evaluateChildrenForMonth(records, month, todayStr, rates).find(
      evaluation => !evaluation.child.archived && evaluation.obligation.notify,
    );
    if (notified) {
      previewVariables = smsVariablesFor({
        child: notified.child,
        parentName: notified.child.parent,
        obligation: notified.obligation,
        month,
      });
    }
  }
  const previewRendered = renderSmsTemplate(draft.body, previewVariables);
  const previewFinal = finalizeSmsText(previewRendered, draft.stripDiacritics);

  return (
    <div className={styles.grid}>
      <div>
        <div className={styles.list}>
          {templatesData.templates.map(template => (
            <Button
              key={template.id}
              type="button"
              variant="ghost"
              className={`${styles.row} ${template.id === selectedId ? styles.rowActive : ''}`}
              onClick={() => selectTemplate(template)}
            >
              <span className={styles.rowName}>{template.name}</span>
              {template.isDefault && <Badge tone="mint">Implicit</Badge>}
            </Button>
          ))}
          <Button type="button" variant="ghost" onClick={startNewTemplate}>
            + Șablon nou
          </Button>
        </div>
        <SmsProviderCard />
      </div>

      <div className={styles.editor}>
        <div className={notificationsStyles.field}>
          <label htmlFor="sms-template-name">Nume</label>
          <TextInput
            id="sms-template-name"
            value={draft.name}
            onChange={value => setDraft(current => ({ ...current, name: value }))}
          />
        </div>

        <div className={notificationsStyles.field}>
          <label htmlFor="sms-template-body">Text</label>
          <div className={styles.pills}>
            {SMS_TEMPLATE_VARIABLES.map(variable => (
              <Button key={variable} type="button" className={styles.pill} onClick={() => insertVariable(variable)}>
                {variable}
              </Button>
            ))}
          </div>
          <TextArea
            id="sms-template-body"
            ref={textareaRef}
            className={styles.textarea}
            value={draft.body}
            onChange={value => setDraft(current => ({ ...current, body: value }))}
          />
        </div>

        <div className={notificationsStyles.toggleField}>
          <Checkbox
            checked={draft.stripDiacritics}
            onChange={value => setDraft(current => ({ ...current, stripDiacritics: value }))}
            ariaLabel="Fără diacritice la trimitere"
          />
          <span>Fără diacritice la trimitere</span>
        </div>
        <div className={notificationsStyles.toggleField}>
          <Checkbox
            checked={draft.isDefault}
            onChange={value => setDraft(current => ({ ...current, isDefault: value }))}
            ariaLabel="Implicit pentru Notifică"
          />
          <span>Implicit pentru Notifică</span>
        </div>

        <p className={styles.preview}>{previewFinal.text}</p>
        <SmsSegmentCounter text={previewFinal.text} unitCost={0.3} />
        {previewFinal.segments > 2 && (
          <p className={styles.warning}>Mesajul e lung: {previewFinal.segments} segmente SMS.</p>
        )}

        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            {selectedId && !draft.isDefault && (
              <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)}>
                Șterge șablonul
              </Button>
            )}
            {selectedId && (
              <span className={styles.usageCount}>Folosit de {templatesData.usageCountById[selectedId] ?? 0} ori</span>
            )}
          </div>
          <div className={styles.footerActions}>
            <Button type="button" variant="ghost" onClick={discard}>
              Renunță
            </Button>
            <Button type="button" variant="primary" onClick={() => void save()}>
              Salvează șablonul
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmingDelete}
        title="Ștergi șablonul?"
        description="Șablonul nu mai poate fi folosit după ștergere."
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
