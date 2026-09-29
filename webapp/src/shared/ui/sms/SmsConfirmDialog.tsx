import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '#shared/format/money-format.mjs';
import { stripDiacritics } from '#shared/format/strip-diacritics.mjs';
import { ScrollArea } from '../ScrollArea';
import { SegmentedControl } from '../SegmentedControl';
import { Checkbox } from '../Checkbox';
// SmsSegmentCounter e definit în shared/sms (Task 16) — e stateless (nu are fetch), deci
// reutilizarea lui aici nu rupe regula „shared/ui fără fetch" a acestui dialog.
import { SmsSegmentCounter, type SmsSendResultView, type SmsTemplateView } from '@shared/sms';
import styles from './SmsConfirmDialog.module.css';

const CUSTOM_TEMPLATE_CHOICE = 'custom';

export interface SmsRecipientView {
  id: string;
  name: string;
  phone: string | null;
  text: string;
  rest?: number;
  excludeReason?: string;
}

/** Alegerea finală din modul single (7c/7e) — un șablon salvat sau text personalizat (`templateId: null`). */
export interface SmsSingleChoiceView {
  templateId: string | null;
  text: string;
  stripDiacritics: boolean;
}

export interface SmsConfirmDialogProps {
  open: boolean;
  mode: 'single' | 'bulk';
  recipients: SmsRecipientView[];
  unitCostLei: number;
  balanceLei: number | null;
  monthlyLimitNote?: string;
  /** Șabloanele disponibile pentru segmented „Șablon" (mod single); lipsă/gol → comportamentul vechi, fără selector. */
  templates?: SmsTemplateView[];
  /** Randează șablonul ales, interpolat pentru destinatarul unic al acestui dialog. */
  renderTemplate?: (templateId: string) => string;
  /** Șablonul preselectat la deschidere; implicit „Personalizat" dacă lipsește sau nu e în `templates`. */
  defaultTemplateId?: string | null;
  onSend: (selectedIds: string[], singleChoice?: SmsSingleChoiceView) => Promise<SmsSendResultView>;
  onRetry?: (failedOrSkippedIds: string[], singleChoice?: SmsSingleChoiceView) => Promise<SmsSendResultView>;
  onClose: () => void;
  onSent: (result: SmsSendResultView) => void;
}

function defaultSelection(recipients: SmsRecipientView[]): Set<string> {
  return new Set(recipients.filter(r => r.phone !== null && !r.excludeReason).map(r => r.id));
}

/** Confirmare + trimitere SMS (unic/lot) — stateless, vezi amendamentul din docs/design/FEEDBACK.md pentru Task 17. */
export function SmsConfirmDialog({
  open,
  mode,
  recipients,
  unitCostLei,
  balanceLei,
  monthlyLimitNote,
  templates,
  renderTemplate,
  defaultTemplateId,
  onSend,
  onRetry,
  onClose,
  onSent,
}: SmsConfirmDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(recipients));
  const [previewIndex, setPreviewIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SmsSendResultView | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [templateChoice, setTemplateChoice] = useState<string>(CUSTOM_TEMPLATE_CHOICE);
  const [customText, setCustomText] = useState('');
  const [stripDiacriticsChecked, setStripDiacriticsChecked] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelected(defaultSelection(recipients));
    setPreviewIndex(0);
    setResult(null);
    setErrorMessage('');
    const hasDefaultTemplate = !!defaultTemplateId && !!templates?.some(template => template.id === defaultTemplateId);
    setTemplateChoice(hasDefaultTemplate ? (defaultTemplateId as string) : CUSTOM_TEMPLATE_CHOICE);
    setCustomText(recipients[0]?.text ?? '');
    setStripDiacriticsChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const checkedRecipients = useMemo(() => recipients.filter(r => selected.has(r.id)), [recipients, selected]);

  if (!open) return null;

  const single = mode === 'single';
  const recipient = recipients[0];
  const balanceWarning = balanceLei !== null && balanceLei < 20 * unitCostLei;

  const selectedTemplate = templates?.find(template => template.id === templateChoice) ?? null;
  // Textul din șablonul ales, brut (cu diacritice) — sursa pentru textarea „Personalizat" la comutare.
  const templateRenderedText =
    templateChoice !== CUSTOM_TEMPLATE_CHOICE
      ? renderTemplate
        ? renderTemplate(templateChoice)
        : (selectedTemplate?.body ?? recipient?.text ?? '')
      : customText;
  const singleBaseText = templateChoice === CUSTOM_TEMPLATE_CHOICE ? customText : templateRenderedText;
  const singleSentText = stripDiacriticsChecked ? stripDiacritics(singleBaseText) : singleBaseText;

  function singleChoiceForSend(): SmsSingleChoiceView | undefined {
    if (!single) return undefined;
    return {
      templateId: templateChoice === CUSTOM_TEMPLATE_CHOICE ? null : templateChoice,
      text: singleSentText,
      stripDiacritics: stripDiacriticsChecked,
    };
  }

  function selectTemplate(choice: string) {
    if (choice === CUSTOM_TEMPLATE_CHOICE) setCustomText(templateRenderedText);
    setTemplateChoice(choice);
  }

  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    setErrorMessage('');
    setSending(true);
    try {
      const ids = single ? (recipient && recipient.phone !== null ? [recipient.id] : []) : [...selected];
      const sendResult = await onSend(ids, singleChoiceForSend());
      setResult(sendResult);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!onRetry || !result) return;
    const failedOrSkippedIds = result.results
      .filter(
        (outcome): outcome is typeof outcome & { childId: string } =>
          (outcome.outcome === 'failed' || outcome.outcome === 'skipped') && outcome.childId !== null,
      )
      .map(outcome => outcome.childId);
    setErrorMessage('');
    setSending(true);
    try {
      setResult(await onRetry(failedOrSkippedIds, singleChoiceForSend()));
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  function close() {
    if (result) onSent(result);
    onClose();
  }

  const sendDisabled = single
    ? sending || !recipient || recipient.phone === null || !!monthlyLimitNote
    : sending || selected.size === 0 || !!monthlyLimitNote;

  const sendCostLei = single ? unitCostLei : selected.size * unitCostLei;
  const sendLabel = single
    ? `Trimite SMS (≈ ${formatMoney(sendCostLei)})`
    : `Trimite ${selected.size} SMS (≈ ${formatMoney(sendCostLei)})`;

  const resultCounts = result
    ? {
        sent: result.results.filter(outcome => outcome.outcome === 'sent').length,
        failed: result.results.filter(outcome => outcome.outcome === 'failed').length,
        skipped: result.results.filter(outcome => outcome.outcome === 'skipped').length,
      }
    : null;
  const canRetry = !!onRetry && !!resultCounts && (resultCounts.failed > 0 || resultCounts.skipped > 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.dialog} ${single ? styles.single : styles.bulk}`}
        role="dialog"
        aria-modal="true"
        aria-label={single ? 'Trimite SMS' : 'Trimite SMS către mai mulți destinatari'}
        onClick={event => event.stopPropagation()}
      >
        <h2 className={styles.title}>{single ? 'Trimite SMS' : `Trimite SMS · ${recipients.length} destinatari`}</h2>

        {single && recipient && (
          <>
            <div className={styles.recipientCard}>
              <span className={styles.recipientName}>{recipient.name}</span>
              {recipient.phone !== null ? (
                <span>{recipient.phone}</span>
              ) : (
                <span className={styles.noPhone}>Fără telefon valid</span>
              )}
              {recipient.rest !== undefined && (
                <span className={styles.recipientRest}>Rest: {formatMoney(recipient.rest)}</span>
              )}
              {recipient.phone === null && (
                <Link className={styles.fixLink} to={`/copii/${recipient.id}`}>
                  Corectează telefonul
                </Link>
              )}
            </div>

            {templates && templates.length > 0 ? (
              <>
                <SegmentedControl<string>
                  ariaLabel="Șablon"
                  value={templateChoice}
                  onChange={selectTemplate}
                  options={[
                    ...templates.map(template => ({ value: template.id, label: template.name })),
                    { value: CUSTOM_TEMPLATE_CHOICE, label: 'Personalizat' },
                  ]}
                />
                {templateChoice === CUSTOM_TEMPLATE_CHOICE && (
                  <textarea
                    className={styles.textarea}
                    aria-label="Text mesaj"
                    value={customText}
                    onChange={event => setCustomText(event.target.value)}
                  />
                )}
                <p className={styles.bubble}>{singleSentText}</p>
                <div className={styles.diacriticsRow}>
                  <Checkbox
                    checked={stripDiacriticsChecked}
                    onChange={setStripDiacriticsChecked}
                    ariaLabel="Fără diacritice"
                  />
                  <span>Fără diacritice</span>
                </div>
                <SmsSegmentCounter text={singleSentText} unitCost={unitCostLei} />
              </>
            ) : (
              <>
                <p className={styles.bubble}>{recipient.text}</p>
                <SmsSegmentCounter text={recipient.text} unitCost={unitCostLei} />
              </>
            )}
          </>
        )}

        {!single && (
          <>
            <ScrollArea className={styles.list}>
              <div className={styles.listInner}>
                {recipients.map(row => (
                  <label key={row.id} className={styles.row}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      disabled={row.phone === null}
                      onChange={() => toggle(row.id)}
                    />
                    <span className={styles.rowName}>{row.name}</span>
                    {row.phone === null ? (
                      <>
                        <span className={styles.noPhone}>Fără telefon valid</span>
                        <Link className={styles.fixLink} to={`/copii/${row.id}`}>
                          Corectează telefonul
                        </Link>
                      </>
                    ) : (
                      row.excludeReason && <span className={styles.excludeReason}>{row.excludeReason}</span>
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
            {checkedRecipients.length > 0 && (
              <div className={styles.preview}>
                <button
                  type="button"
                  className={styles.previewNav}
                  aria-label="Mesajul anterior"
                  disabled={previewIndex === 0}
                  onClick={() => setPreviewIndex(index => Math.max(0, index - 1))}
                >
                  ‹
                </button>
                <div>
                  <p className={styles.bubble}>
                    {checkedRecipients[Math.min(previewIndex, checkedRecipients.length - 1)]?.text}
                  </p>
                  <span>
                    {Math.min(previewIndex, checkedRecipients.length - 1) + 1} din {checkedRecipients.length}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.previewNav}
                  aria-label="Mesajul următor"
                  disabled={previewIndex >= checkedRecipients.length - 1}
                  onClick={() => setPreviewIndex(index => Math.min(checkedRecipients.length - 1, index + 1))}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}

        {balanceWarning && <p className={styles.warning}>Sold sms.md scăzut: {formatMoney(balanceLei)}.</p>}
        {monthlyLimitNote && <p className={styles.limitNote}>{monthlyLimitNote}</p>}
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

        {resultCounts && (
          <div>
            <p className={styles.resultSummary}>
              {resultCounts.sent} trimise · {resultCounts.failed} eșuate · {resultCounts.skipped} netrimise
            </p>
            {result?.stopped && <p className={styles.error}>{result.stopped.message}</p>}
            <ul className={styles.resultErrors}>
              {result?.results
                .filter(outcome => outcome.error)
                .map(outcome => (
                  <li key={outcome.childId}>{outcome.error}</li>
                ))}
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          {!resultCounts && (
            <>
              <button type="button" className={styles.btnGhost} onClick={onClose}>
                Anulează
              </button>
              <button type="button" className={styles.btnPrimary} disabled={sendDisabled} onClick={() => void send()}>
                {sendLabel}
              </button>
            </>
          )}
          {resultCounts && (
            <>
              {canRetry && (
                <button type="button" className={styles.btnGhost} disabled={sending} onClick={() => void retry()}>
                  Reîncearcă
                </button>
              )}
              <button type="button" className={styles.btnPrimary} onClick={close}>
                Închide
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
