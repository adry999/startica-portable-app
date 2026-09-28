import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Button, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { today } from '@domain/calendar-month.mjs';
import { GENERAL_CATEGORY_NAME } from '#shared/domain/expense-categories.mjs';
import { categoryStyleFor, type ExpenseFormInput } from './useExpenses';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

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
        <label className={styles.editorField}>
          Data cheltuielii
          <input type="date" required value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className={`${styles.editorField} ${styles.amountField}`}>
          Suma
          <input
            ref={amountInputRef}
            type="number"
            required
            min={0.01}
            step="0.01"
            className={styles.amountInput}
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
        </label>
        <div className={styles.editorField}>
          Categorie
          <div className={styles.categoryChips} role="radiogroup" aria-label="Categorie">
            {categoryNames.map(name => {
              const { color } = categoryStyleFor(name);
              const selected = name === category;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={styles.categoryChip}
                  data-selected={selected || undefined}
                  style={{ '--chip-color': color } as CSSProperties}
                  onClick={() => setCategory(name)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <label className={styles.editorField}>
          Metodă
          <select value={method} onChange={event => setMethod(event.target.value)}>
            {editing && !method ? <option value="">Nespecificată</option> : null}
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>
        <label className={styles.editorField}>
          Descriere
          <input type="text" value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        <label className={styles.editorField}>
          Observații
          <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} />
        </label>
      </form>
    </Drawer>
  );
}
