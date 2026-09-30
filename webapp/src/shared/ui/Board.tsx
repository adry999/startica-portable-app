import { useState } from 'react';
import styles from './Board.module.css';

export interface BoardCard {
  key: string;
  label: string;
}

export interface BoardColumn {
  key: string;
  title: string;
  cards: BoardCard[];
  /** Dacă e dat, coloana refuză drop-uri și arată motivul (ex. „Grupa e plină”). */
  disabledReason?: string;
}

export interface BoardProps {
  columns: BoardColumn[];
  onMoveCard: (cardKey: string, fromColumnKey: string, toColumnKey: string) => void;
  className?: string;
}

/**
 * Panou cu coloane și carduri trase de la o coloană la alta (COMPONENTE.md §0f, 31a).
 * V1, simplificat deliberat față de spec:
 * - drag&drop nativ HTML5 direct în componentă, fără un modul `@shared/dnd` separat —
 *   se extrage abia când un al doilea consumator are nevoie de aceeași logică.
 * - fără reordonare cu tastatura (Space/săgeți din spec) — accesibilitate incompletă,
 *   follow-up real, nu doar o notă.
 * - țintă validă = inel portocaliu 3px; fără linia de inserare și fără rotația de -2° a copiei trase.
 */
export function Board({ columns, onMoveCard, className }: BoardProps) {
  const [draggedCard, setDraggedCard] = useState<{ cardKey: string; fromColumnKey: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  function handleDrop(column: BoardColumn) {
    if (!draggedCard || column.disabledReason) {
      setDragOverColumn(null);
      return;
    }
    if (draggedCard.fromColumnKey !== column.key) {
      onMoveCard(draggedCard.cardKey, draggedCard.fromColumnKey, column.key);
    }
    setDraggedCard(null);
    setDragOverColumn(null);
  }

  return (
    <div className={[styles.board, className].filter(Boolean).join(' ')}>
      {columns.map(column => (
        <div
          key={column.key}
          className={[
            styles.column,
            dragOverColumn === column.key && !column.disabledReason ? styles.dropTarget : '',
            column.disabledReason ? styles.disabled : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={event => {
            event.preventDefault();
            setDragOverColumn(column.key);
          }}
          onDragLeave={() => setDragOverColumn(current => (current === column.key ? null : current))}
          onDrop={event => {
            event.preventDefault();
            handleDrop(column);
          }}
        >
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>{column.title}</span>
            <span className={styles.columnCount}>{column.cards.length}</span>
          </div>
          {column.disabledReason && <p className={styles.disabledReason}>{column.disabledReason}</p>}
          <div className={styles.cards}>
            {column.cards.map(card => (
              <div
                key={card.key}
                className={draggedCard?.cardKey === card.key ? `${styles.card} ${styles.dragging}` : styles.card}
                draggable
                onDragStart={() => setDraggedCard({ cardKey: card.key, fromColumnKey: column.key })}
                onDragEnd={() => {
                  setDraggedCard(null);
                  setDragOverColumn(null);
                }}
              >
                {card.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
