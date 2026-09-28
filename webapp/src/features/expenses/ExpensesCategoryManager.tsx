import { useState, type FormEvent } from 'react';
import { useToast } from '@shared/ui';
import { GENERAL_CATEGORY_ID } from '#shared/domain/expense-categories.mjs';
import type { ExpenseCategory } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export interface ExpensesCategoryManagerProps {
  categories: ExpenseCategory[];
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (id: string, name: string) => Promise<void>;
  onRequestDelete: (category: ExpenseCategory) => void;
}

/** Chip-urile de categorii, cu editare/adăugare inline — stare proprie, izolată de restul filtrelor din ExpensesPage. */
export function ExpensesCategoryManager({
  categories,
  onCreateCategory,
  onRenameCategory,
  onRequestDelete,
}: ExpensesCategoryManagerProps) {
  const toast = useToast();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  async function handleCreateCategory(event: FormEvent) {
    event.preventDefault();
    try {
      await onCreateCategory(newCategoryName);
      setNewCategoryName('');
      toast.show({ message: 'Categorie adăugată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function startEditingCategory(id: string, name: string) {
    setEditingCategoryId(id);
    setEditingCategoryName(name);
  }

  async function commitEditingCategory() {
    if (!editingCategoryId) return;
    const id = editingCategoryId;
    setEditingCategoryId(null);
    try {
      await onRenameCategory(id, editingCategoryName);
      toast.show({ message: 'Categorie redenumită.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <div className={styles.chipsRow}>
      <div className={styles.chips}>
        {categories.length === 0 ? (
          <span className={styles.notice}>Nicio categorie adăugată încă — se folosesc doar sugestiile implicite.</span>
        ) : (
          categories.map(category =>
            editingCategoryId === category.id ? (
              <span key={category.id} className={styles.chip}>
                <input
                  autoFocus
                  className={styles.chipEditInput}
                  style={{ width: `${Math.max(4, editingCategoryName.length)}ch` }}
                  value={editingCategoryName}
                  aria-label={`Redenumește ${category.name}`}
                  onChange={event => setEditingCategoryName(event.target.value)}
                  onBlur={() => void commitEditingCategory()}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void commitEditingCategory();
                    } else if (event.key === 'Escape') {
                      setEditingCategoryId(null);
                    }
                  }}
                />
              </span>
            ) : (
              <span key={category.id} className={styles.chip}>
                <button
                  type="button"
                  className={styles.chipLabel}
                  title="Redenumește categoria"
                  onClick={() => startEditingCategory(category.id, category.name)}
                >
                  {category.name}
                </button>
                {/* „General” e permanentă — destinația cheltuielilor rămase fără categorie — deci nu se poate șterge. */}
                {category.id !== GENERAL_CATEGORY_ID && (
                  <button
                    type="button"
                    aria-label={`Șterge ${category.name}`}
                    title="Șterge categoria"
                    onClick={() => onRequestDelete(category)}
                  >
                    ×
                  </button>
                )}
              </span>
            ),
          )
        )}
      </div>
      <form className={styles.chipForm} onSubmit={handleCreateCategory}>
        <input
          value={newCategoryName}
          onChange={event => setNewCategoryName(event.target.value)}
          placeholder="Categorie nouă"
          aria-label="Categoria nouă"
        />
        <button type="submit" className={styles.btnGhostSmall}>
          + Adaugă
        </button>
      </form>
    </div>
  );
}
