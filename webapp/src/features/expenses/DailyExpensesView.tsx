import { useState, type FormEvent } from 'react';
import { today } from '@domain/calendar-month.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { categoryStyleFor, type ExpenseFormInput } from './useExpenses';
import { METHOD_LABEL } from './expenseColumns';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export interface DailyGroup {
  date: string;
  items: Expense[];
  dayTotal: number;
}

const TONE_CLASS: Record<string, string | undefined> = {
  orange: styles.dayRowIconOrange,
  mint: styles.dayRowIconMint,
  yellow: styles.dayRowIconYellow,
  pink: styles.dayRowIconPink,
  neutral: styles.dayRowIconNeutral,
};

/** Blocul „Adaugă rapid" (mint) din 6b — sumă, descriere, dată, metodă + chip-uri de categorie. */
function QuickAddExpense({
  categoryNames,
  onSubmit,
}: {
  categoryNames: string[];
  onSubmit: (input: ExpenseFormInput) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('cash');
  const [category, setCategory] = useState(categoryNames[0] ?? 'General');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!amount || !description.trim()) return;
    const ok = await onSubmit({ date, amount, category, method, description, notes: '' });
    if (ok) {
      setAmount('');
      setDescription('');
    }
  }

  return (
    <form className={styles.quickAdd} onSubmit={handleSubmit}>
      <span className={styles.quickAddTitle}>Adaugă rapid</span>
      <div className={styles.quickAddRow}>
        <input
          className={styles.quickAddAmount}
          type="number"
          min="0"
          step="0.01"
          placeholder="Sumă"
          aria-label="Sumă"
          value={amount}
          onChange={event => setAmount(event.target.value)}
        />
        <input
          className={styles.quickAddDesc}
          type="text"
          placeholder="Descriere"
          aria-label="Descriere"
          value={description}
          onChange={event => setDescription(event.target.value)}
        />
        <input
          className={styles.quickAddDate}
          type="date"
          aria-label="Data"
          value={date}
          onChange={event => setDate(event.target.value)}
        />
        <select
          className={styles.quickAddMethod}
          aria-label="Metodă"
          value={method}
          onChange={event => setMethod(event.target.value)}
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Transfer</option>
        </select>
        <button type="submit" className={styles.quickAddSubmit}>
          Adaugă
        </button>
      </div>
      <div className={styles.quickAddChips}>
        {categoryNames.map(name => (
          <button
            key={name}
            type="button"
            className={name === category ? `${styles.quickAddChip} ${styles.quickAddChipActive}` : styles.quickAddChip}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </form>
  );
}

export interface DailyExpensesViewProps {
  groups: DailyGroup[];
  categoryNames: string[];
  onQuickAdd: (input: ExpenseFormInput) => Promise<boolean>;
}

/** Vizualizarea „Pe zile" (6b) — fără coloana de buget, funcție amânată. */
export function DailyExpensesView({ groups, categoryNames, onQuickAdd }: DailyExpensesViewProps) {
  return (
    <div className={styles.dailyWrap}>
      <QuickAddExpense categoryNames={categoryNames} onSubmit={onQuickAdd} />

      {groups.length === 0 ? (
        <p className={styles.notice}>Nu există înregistrări pentru filtrele alese.</p>
      ) : (
        <div className={styles.dailyList}>
          {groups.map(group => (
            <div key={group.date} className={styles.dayGroup}>
              <div className={styles.dayHead}>
                <strong>{formatDate(group.date)}</strong>
                <span>{formatMoney(group.dayTotal)}</span>
              </div>
              {group.items.map(expense => {
                const style = categoryStyleFor(expense.category);
                const meta = [expense.category, expense.notes, expense.method ? METHOD_LABEL[expense.method] : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <div key={expense.id} className={styles.dayRow}>
                    <span className={`${styles.dayRowIcon} ${TONE_CLASS[style.tone] ?? ''}`}>
                      {expense.category.charAt(0).toUpperCase()}
                    </span>
                    <div className={styles.dayRowBody}>
                      <span className={styles.dayRowDesc}>{expense.description || '—'}</span>
                      <span className={styles.dayRowMeta}>{meta}</span>
                    </div>
                    <span className={styles.dayRowAmount}>{formatMoney(expense.amount)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
