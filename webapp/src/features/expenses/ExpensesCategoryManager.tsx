import { useState, type FormEvent } from 'react';
import { Button, EMPTY_STATES, EmptyState, IconButton, TextInput, resolveEmptyStateTitle, useToast } from '@shared/ui';
import { GENERAL_CATEGORY_ID } from '#shared/domain/expense-categories.mjs';
import type { ExpenseCategory } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';
import { toUserError } from '@shared/api/to-user-error';

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
      toast.show({ message: toUserError(error) });
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
      toast.show({ message: toUserError(error) });
    }
  }

  return (
    <div className={styles.chipsRow}>
      <div className={styles.chips}>
        {categories.length === 0 ? (
          <EmptyState
            variant={EMPTY_STATES['cheltuieli.categories'].variant}
            size={EMPTY_STATES['cheltuieli.categories'].size}
            title={resolveEmptyStateTitle(EMPTY_STATES['cheltuieli.categories'])}
          />
        ) : (
          categories.map(category =>
            editingCategoryId === category.id ? (
              <span key={category.id} className={styles.chip}>
                <TextInput
                  className={styles.chipEditInput}
                  autoFocus
                  value={editingCategoryName}
                  ariaLabel={`Redenumește ${category.name}`}
                  onChange={setEditingCategoryName}
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
                <Button
                  variant="link"
                  className={styles.chipLabel}
                  title="Redenumește categoria"
                  onClick={() => startEditingCategory(category.id, category.name)}
                >
                  {category.name}
                </Button>
                {/* „General” e permanentă — destinația cheltuielilor rămase fără categorie — deci nu se poate șterge. */}
                {category.id !== GENERAL_CATEGORY_ID && (
                  <IconButton
                    className={styles.chipDelete}
                    icon="close"
                    ariaLabel={`Șterge ${category.name}`}
                    title="Șterge categoria"
                    onClick={() => onRequestDelete(category)}
                  />
                )}
              </span>
            ),
          )
        )}
      </div>
      <form className={styles.chipForm} autoComplete="off" onSubmit={handleCreateCategory}>
        <TextInput
          value={newCategoryName}
          onChange={setNewCategoryName}
          placeholder="Categorie nouă"
          ariaLabel="Categoria nouă"
        />
        <Button type="submit" variant="ghost" className={styles.btnGhostSmall}>
          + Adaugă
        </Button>
      </form>
    </div>
  );
}
