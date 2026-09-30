import { useRef, useState, type FormEvent } from 'react';
import { AmountInput, Button, DateInput, Drawer, Field, FilterPills, Select, TextArea, TextInput } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { today } from '@domain/calendar-month.mjs';
import { GENERAL_CATEGORY_NAME } from '#shared/domain/expense-categories.mjs';
import { categoryStyleFor, type ExpenseFormInput } from './useExpenses';
import { METHOD_LABEL } from './expenseColumns';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

const METHOD_OPTIONS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));

export function ExpenseFormDrawer({
  target,
  categoryNames,
  onSubmit,
  onSubmitAndAddAnother,
  onClose,
}: {
  target: Expense | 'new' | null;
  categoryNames: string[];
  /** C1: întoarce succesul real al salvării (true doar după mutate reușit) — vezi save() mai jos. */
  onSubmit: (input: ExpenseFormInput) => Promise<boolean>;
  /** FM-2 (15c): „Salvează și adaugă alta” — salvează fără să închidă Drawer-ul (ca `onQuickAdd`
   * de la blocul „Adaugă rapid”, Pe zile — aceeași semantică, doar declanșată din formular). */
  onSubmitAndAddAnother: (input: ExpenseFormInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [date, setDate] = useState(editing?.date || today());
  const [amount, setAmount] = useState(editing?.amount !== undefined ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category || GENERAL_CATEGORY_NAME);
  const [method, setMethod] = useState(editing?.method || (editing ? '' : 'cash'));
  const [description, setDescription] = useState(editing?.description || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const amountInputRef = useRef<HTMLInputElement>(null);
  // Valorile de la montare — comparate cu cele curente pentru garda de formular nesalvat (13b).
  const initialValuesRef = useRef({ date, amount, category, method, description, notes });
  // M12: fără gardă de dublu-clic, două clicuri rapide pe Salvează porneau a doua mutație cât
  // prima era încă „pending” → toast de eroare tehnic, deși prima salvare reușea.
  const [submitting, setSubmitting] = useState(false);

  // C1: se așteaptă mutația (nu mai e fire-and-forget) și se întoarce succesul ei real —
  // altfel save() din dirty-forms (13b) și garda „Salvează și schimbă” a filialei ar crede
  // că s-a salvat înainte ca mutația să fi pornit măcar.
  async function submitForm(): Promise<boolean> {
    if (submitting) return false;
    setSubmitting(true);
    try {
      return await onSubmit({ date, amount, category, method, description, notes });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitForm();
  }

  // FM-2 (15c): „Salvează și adaugă alta” — salvează, golește suma/descrierea/notițele
  // (data, categoria și metoda rămân, ca la introducerea mai multor cheltuieli la rând),
  // Drawer-ul rămâne deschis, focus înapoi pe sumă.
  async function handleSaveAndAddAnother() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmitAndAddAnother({ date, amount, category, method, description, notes });
      if (ok) {
        setAmount('');
        setDescription('');
        setNotes('');
        initialValuesRef.current = { date, amount: '', category, method, description: '', notes: '' };
        amountInputRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const currentValues = { date, amount, category, method, description, notes };
  const dirty = target !== null && JSON.stringify(currentValues) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'o cheltuială', save: submitForm } : null);

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: cheltuială' : 'Adaugă: cheltuială'}
      width={520}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <div />
          <div className={styles.footerRight}>
            {!editing && (
              <Button variant="outline" onClick={() => void handleSaveAndAddAnother()} disabled={submitting}>
                Salvează și adaugă alta
              </Button>
            )}
            <Button type="submit" form="expense-form-drawer" disabled={submitting}>
              Salvează
            </Button>
          </div>
        </div>
      }
    >
      <form id="expense-form-drawer" className={styles.editorForm} onSubmit={handleSubmit}>
        <Field label="Data cheltuielii" htmlFor="expense-date">
          <DateInput id="expense-date" required value={date} onChange={setDate} />
        </Field>
        <Field label="Suma" htmlFor="expense-amount">
          <AmountInput
            id="expense-amount"
            inputRef={amountInputRef}
            required
            min={0.01}
            step="0.01"
            value={amount}
            onChange={setAmount}
            currency="lei"
          />
        </Field>
        <div className={styles.editorField}>
          Categorie
          <FilterPills
            className={styles.categoryChips}
            groups={[
              {
                label: '',
                value: category,
                onChange: setCategory,
                options: categoryNames.map(name => ({ value: name, label: name, tone: categoryStyleFor(name).tone })),
              },
            ]}
          />
        </div>
        <Field label="Metodă" htmlFor="expense-method">
          <Select
            id="expense-method"
            value={method}
            onChange={setMethod}
            options={METHOD_OPTIONS}
            placeholder={editing && !method ? 'Nespecificată' : undefined}
          />
        </Field>
        <Field label="Descriere" htmlFor="expense-description">
          <TextInput id="expense-description" value={description} onChange={setDescription} />
        </Field>
        <Field label="Observații" htmlFor="expense-notes">
          <TextArea id="expense-notes" rows={3} value={notes} onChange={setNotes} />
        </Field>
      </form>
    </Drawer>
  );
}
