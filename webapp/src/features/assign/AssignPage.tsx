import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  LoadingState,
  ScrollArea,
  SearchInput,
  SearchSelect,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { initials } from '@shared/format/initials';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { useAssign, type AssignRowView, type ChildOption } from './useAssign';
import styles from './AssignPage.module.css';

export interface AssignPageProps {
  month: string;
}

// „10.09.2026" -> ziua + luna (numerică, nu abreviată — evită duplicarea listei de nume de
// luni din #shared/format/date-format.mjs doar pentru acest bloc vizual).
function splitDateLabel(dateLabel: string): { day: string; month: string } {
  const [day = '', month = ''] = dateLabel.split('.');
  return { day, month };
}

// Eticheta unei opțiuni e „Nume — motive" (useAssign.ts, suggestionLabel); pentru „Toți copiii"
// e doar numele, deci separatorul lipsește și numele rămâne întreg.
function splitSuggestionLabel(label: string): { name: string; reason: string } {
  const sep = label.indexOf(' — ');
  return sep === -1 ? { name: label, reason: '' } : { name: label.slice(0, sep), reason: label.slice(sep + 3) };
}

type SuggestionTone = 'mint' | 'yellow' | 'neutral';

// 3 trepte (11-de-rezolvat.md §9c): nume potrivit = sigur; fără nume dar cu ≥2 indicii
// independente (sumă + lună neachitată) = posibil; un singur indiciu slab = de verificat.
// Pragul „2” e o interpretare provizorie a scorului din payment-name-matching.mjs — nu
// vine din spec, notat în INTREBARI.md ca decizie deschisă.
function suggestionTone(option: ChildOption): SuggestionTone {
  if (option.nameMatch) return 'mint';
  return option.score >= 2 ? 'yellow' : 'neutral';
}

const TONE_LABEL: Record<SuggestionTone, string> = {
  mint: 'Potrivire mare',
  yellow: 'Posibil',
  neutral: 'Slab',
};

export function AssignPage({ month }: AssignPageProps) {
  const assignData = useAssign(month);
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(() => searchParams.get('id'));
  const [search, setSearch] = useState('');

  const totalAmount = assignData.rows.reduce((sum, row) => sum + row.amount, 0);

  useTopbarActions(
    <span className={styles.headerStat}>
      <strong>{assignData.risk.unassigned}</strong> achitări fără copil · {formatMoney(totalAmount)}
    </span>,
  );

  if (assignData.status === 'loading') return <LoadingState />;
  if (assignData.status === 'failed')
    return <p className={styles.notice}>{assignData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  if (assignData.rows.length === 0) {
    return <EmptyState variant="done" title="Nu există achitări neasociate." />;
  }

  function fillSuggested() {
    const count = assignData.fillSuggested();
    toast.show({ message: count ? `${count} rânduri completate.` : 'Nicio potrivire unică de nume găsită.' });
  }

  async function save() {
    try {
      const { saved } = await assignData.save();
      toast.show({ message: `${saved} achitări asociate.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const query = search.trim().toLocaleLowerCase('ro-RO');
  const filteredRows = query
    ? assignData.rows.filter(
        row =>
          (row.source || '').toLocaleLowerCase('ro-RO').includes(query) ||
          row.amountLabel.toLocaleLowerCase('ro-RO').includes(query),
      )
    : assignData.rows;

  const foundIndex = assignData.rows.findIndex(row => row.paymentId === activeId);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = assignData.rows[activeIndex] ?? null;

  const matchedOptions = active ? active.options.filter(option => option.group !== 'Toți copiii') : [];
  const selectedOption = active ? (active.options.find(option => option.id === active.selectedChildId) ?? null) : null;
  const selectedChildName = selectedOption ? splitSuggestionLabel(selectedOption.label).name : '';

  return (
    <>
      <div className={styles.subStats}>
        <span className={styles.subStatItem}>
          <strong>{assignData.risk.unassigned}</strong>
          <span className={styles.subStatLabel}>nu se scad din datoria nimănui</span>
        </span>
        <span className={styles.subStatDivider} aria-hidden="true" />
        <span className={styles.subStatItem}>
          <strong>
            {assignData.risk.coveringMonth} · {formatMoney(assignData.risk.amountCoveringMonth)}
          </strong>
          <span className={styles.subStatLabel}>Din care pe luna {formatMonthLabel(month)}</span>
        </span>
      </div>

      <div className={styles.grid}>
        <Card className={styles.queueCard}>
          <div className={styles.queueToolbar}>
            <SearchInput
              className={styles.search}
              placeholder="Caută plătitor sau sumă"
              value={search}
              onChange={setSearch}
              ariaLabel="Caută plătitor sau sumă"
            />
          </div>
          <ScrollArea className={styles.queueList}>
            {filteredRows.length === 0 ? (
              <p className={styles.queueEmpty}>Niciun rezultat pentru căutare.</p>
            ) : (
              filteredRows.map(row => (
                <PaymentRow
                  key={row.paymentId}
                  row={row}
                  active={row.paymentId === active?.paymentId}
                  onSelect={() => setActiveId(row.paymentId)}
                />
              ))
            )}
          </ScrollArea>
        </Card>

        {active && (
          <Card className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <span className={styles.detailEyebrow}>Achitare selectată · {active.dateLabel}</span>
              <span className={styles.detailAmount}>
                {active.source || 'Fără nume în sursă'} · {active.amountLabel}
              </span>
              <p className={styles.bankBox}>
                {active.source ? `Detalii bancă: „${active.source}”` : 'Fără text de sursă în extras.'}
              </p>
            </div>

            <span className={styles.suggestionsTitle}>Sugestii</span>
            <div className={styles.suggestions}>
              {matchedOptions.length === 0 ? (
                <p className={styles.noSuggestions}>Nicio sugestie — caută mai jos.</p>
              ) : (
                matchedOptions.map(option => (
                  <SuggestionCard
                    key={option.id}
                    option={option}
                    tone={suggestionTone(option)}
                    onAssign={() => assignData.selectChild(active.paymentId, option.id)}
                  />
                ))
              )}
            </div>

            <div className={styles.altChildField}>
              <span className={styles.altChildIcon}>
                <Icon name="search" size={14} />
              </span>
              <SearchSelect
                value={active.selectedChildId}
                onChange={childId => assignData.selectChild(active.paymentId, childId)}
                options={active.options.map(option => ({
                  value: option.id,
                  label: splitSuggestionLabel(option.label).name,
                }))}
                placeholder="Alt copil…"
                ariaLabel={`Copil pentru achitarea din ${active.dateLabel}`}
              />
            </div>

            <label className={styles.rememberField}>
              <Checkbox
                checked={active.remember}
                disabled={!active.canRemember || !active.selectedChildId}
                onChange={() => assignData.toggleRemember(active.paymentId)}
                ariaLabel={
                  active.selectedChildId
                    ? `Ține minte: plătitorul „${active.source}” = ${selectedChildName} pentru achitările viitoare`
                    : 'Ține minte plătitorul'
                }
              />
              <span>
                {active.selectedChildId
                  ? `Ține minte: plătitorul „${active.source}” = ${selectedChildName} pentru achitările viitoare`
                  : 'Ține minte plătitorul'}
              </span>
            </label>
          </Card>
        )}
      </div>

      <div className={styles.saveRow}>
        <Button variant="ghost" onClick={fillSuggested}>
          Completează cu prima sugestie
        </Button>
        <Button variant="ghost" onClick={assignData.clearSelections}>
          Golește selecțiile
        </Button>
        <Button size="lg" disabled={assignData.saving} onClick={() => void save()} className={styles.saveButton}>
          Salvează asocierile ({assignData.selectedCount})
        </Button>
      </div>
    </>
  );
}

function PaymentRow({ row, active, onSelect }: { row: AssignRowView; active: boolean; onSelect: () => void }) {
  const { day, month } = splitDateLabel(row.dateLabel);
  const details = row.monthLines.length > 0 ? row.monthLines.join(', ') : 'fără lună alocată';
  return (
    <button
      type="button"
      className={active ? `${styles.queueRow} ${styles.queueRowActive}` : styles.queueRow}
      aria-current={active}
      onClick={onSelect}
    >
      <span className={styles.queueDate}>
        <strong>{day}</strong>
        <small>{month}</small>
      </span>
      <span className={styles.queueText}>
        <strong>{row.source || 'fără text în sursă'}</strong>
        <small>
          {row.method || 'Transfer'} · {details}
        </small>
      </span>
      <strong className={styles.queueAmount}>{row.amountLabel}</strong>
    </button>
  );
}

function SuggestionCard({
  option,
  tone,
  onAssign,
}: {
  option: ChildOption;
  tone: SuggestionTone;
  onAssign: () => void;
}) {
  const { name, reason } = splitSuggestionLabel(option.label);
  return (
    <div className={`${styles.suggestionCard} ${styles[tone]}`}>
      <span className={styles.suggestionAvatar}>{initials(name)}</span>
      <div className={styles.suggestionText}>
        <strong>{name}</strong>
        {reason && <small>{reason}</small>}
      </div>
      <span className={`${styles.suggestionScore} ${styles[tone]}`}>{TONE_LABEL[tone]}</span>
      <Button variant={tone === 'mint' ? 'primary' : 'outline'} onClick={onAssign}>
        Asociază
      </Button>
    </div>
  );
}
