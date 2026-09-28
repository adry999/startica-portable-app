import { useRef, useState, type FormEvent } from 'react';
import { Button, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { today } from '@domain/calendar-month.mjs';
import { GENERAL_CATEGORY_NAME } from '#shared/domain/expense-categories.mjs';
import type { ExpenseFormInput } from './useExpenses';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export function ExpenseFormDrawer({
  target,
  categoryNames,
  onSubmit,
  onClose,
}: {
  target: Expense | 'new' | null;
  categoryNames: string[];
  /** C1: întoarce succesul real al salvării (true doar după mutate reușit) — vezi save() mai jos. */
  onSubmit: (input: ExpenseFormInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [date, setDate] = useState(editing?.date || today());
  const [amount, setAmount] = useState(editing?.amount !== undefined ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category || GENERAL_CATEGORY_NAME);
  const [method, setMethod] = useState(editing?.method || (editing ? '' : 'cash'));
  const [description, setDescription] = useState(editing?.description || '');
  const [notes, setNotes] = useState(editing?.notes || '');
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
        <Button type="submit" form="expense-form-drawer" disabled={submitting}>
          Salvează
        </Button>
      }
    >
      <form id="expense-form-drawer" className={styles.editorForm} onSubmit={handleSubmit}>
        <label className={styles.editorField}>
          Data cheltuielii
          <input type="date" required value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className={styles.editorField}>
          Suma
          <input
            type="number"
            required
            min={0.01}
            step="0.01"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
        </label>
        <label className={styles.editorField}>
          Categorie
          <input
            type="text"
            required
            list="expenseCategoryOptions"
            value={category}
            onChange={event => setCategory(event.target.value)}
          />
          <datalist id="expenseCategoryOptions">
            {categoryNames.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
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
