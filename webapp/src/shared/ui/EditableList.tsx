import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';
import styles from './EditableList.module.css';

export interface EditableListProps<T> {
  title: string;
  items: T[];
  getId: (item: T) => string;
  mode: 'view' | 'edit';
  /** Randarea unui element în modul de citire. */
  renderView: (item: T, index: number) => ReactNode;
  /** Randarea unui element în modul de editare — fără butonul de ștergere, adăugat separat. */
  renderEdit: (item: T, index: number) => ReactNode;
  /** Întoarce `undefined` dacă elementul se poate șterge, altfel textul tooltip-ului (ex. „Folosit de 14 copii”). */
  deleteHint: (item: T) => string | undefined;
  onDelete: (id: string) => void;
  /** „+ Adaugă X” — vizibil în ambele moduri: din `view` trece direct în `edit` cu un rând nou gol. */
  onAdd: () => void;
  addLabel: string;
  editLabel: string;
  onEnterEdit: () => void;
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  footerNote?: ReactNode;
  emptyState?: ReactNode;
}

/**
 * Listă cu mod `view` (doar citire + „+ Adaugă”/„Editează”) și mod `edit` (câmpuri + ștergere
 * condiționată, „Anulează”/„Salvează”) — COMPONENTE.md §3b (38d Planuri, 38f Funcții).
 */
export function EditableList<T>({
  title,
  items,
  getId,
  mode,
  renderView,
  renderEdit,
  deleteHint,
  onDelete,
  onAdd,
  addLabel,
  editLabel,
  onEnterEdit,
  dirty,
  saving,
  onSave,
  onCancel,
  footerNote,
  emptyState,
}: EditableListProps<T>) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {mode === 'view' && (
          <div className={styles.headerActions}>
            <Button type="button" variant="outline" onClick={onEnterEdit}>
              {editLabel}
            </Button>
            <Button type="button" variant="primary" onClick={onAdd}>
              {addLabel}
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 && emptyState}

      <div className={styles.list}>
        {items.map((item, index) => {
          const id = getId(item);
          const hint = mode === 'edit' ? deleteHint(item) : undefined;
          return (
            <div key={id} className={mode === 'edit' ? styles.rowEdit : styles.rowView}>
              <div className={styles.rowContent}>
                {mode === 'view' ? renderView(item, index) : renderEdit(item, index)}
              </div>
              {mode === 'edit' &&
                (hint ? (
                  <Tooltip content={hint}>
                    <span>
                      <IconButton icon="close" ariaLabel={`Șterge ${title.toLowerCase()}`} disabled />
                    </span>
                  </Tooltip>
                ) : (
                  <IconButton icon="close" ariaLabel={`Șterge ${title.toLowerCase()}`} onClick={() => onDelete(id)} />
                ))}
            </div>
          );
        })}
      </div>

      {mode === 'edit' && (
        <div className={styles.footer}>
          {footerNote && <span className={styles.footerNote}>{footerNote}</span>}
          <Button type="button" variant="ghost" onClick={onAdd}>
            {addLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Anulează
          </Button>
          <Button type="button" variant="primary" disabled={!dirty || saving} loading={saving} onClick={onSave}>
            {saving ? 'Salvez…' : 'Salvează'}
          </Button>
        </div>
      )}
    </div>
  );
}
