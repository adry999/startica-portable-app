import { useState, type FormEvent } from 'react';
import { Drawer } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
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
  onSubmit: (input: ExpenseFormInput) => void;
  onClose: () => void;
}) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [date, setDate] = useState(editing?.date || today());
  const [amount, setAmount] = useState(editing?.amount !== undefined ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category || 'Altele');
  const [method, setMethod] = useState(editing?.method || (editing ? '' : 'cash'));
  const [description, setDescription] = useState(editing?.description || '');
  const [notes, setNotes] = useState(editing?.notes || '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ date, amount, category, method, description, notes });
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: cheltuială' : 'Adaugă: cheltuială'}
      width={520}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => onSubmit({ date, amount, category, method, description, notes })}
        >
          Salvează
        </button>
      }
    >
      <form className={styles.editorForm} onSubmit={handleSubmit}>
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
