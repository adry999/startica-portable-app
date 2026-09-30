import type { ReactNode } from 'react';
import { useState } from 'react';
import { Icon } from './Icon';
import styles from './SettingsList.module.css';

export interface SettingsListItem {
  id: string;
}

export interface SettingsListProps<T extends SettingsListItem> {
  items: T[];
  ariaLabel: string;
  renderName: (item: T) => ReactNode;
  renderCount?: (item: T) => ReactNode;
  renderStatus?: (item: T) => ReactNode;
  renderActions?: (item: T) => ReactNode;
  /** Rândul se poate trage doar dacă e adevărat (implicit da) — necesită și `onReorder`. */
  isDraggable?: (item: T) => boolean;
  onReorder?: (draggedId: string, targetId: string) => void;
  emptyMessage?: ReactNode;
}

/**
 * Lista editabilă cu mâner, pastilă, contor, stare, acțiuni (COMPONENTE.md §2 „SettingsList") —
 * grid `24px 1fr 150px 120px auto`. Titlul secțiunii și „+ Element” rămân în ecranul care o folosește.
 */
export function SettingsList<T extends SettingsListItem>({
  items,
  ariaLabel,
  renderName,
  renderCount,
  renderStatus,
  renderActions,
  isDraggable = () => true,
  onReorder,
  emptyMessage,
}: SettingsListProps<T>) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (items.length === 0) {
    return emptyMessage != null ? <p className={styles.empty}>{emptyMessage}</p> : null;
  }

  return (
    <div className={styles.list} role="list" aria-label={ariaLabel}>
      {items.map(item => {
        const draggable = Boolean(onReorder) && isDraggable(item);
        return (
          <div
            key={item.id}
            role="listitem"
            className={`${styles.row} ${dragOverId === item.id ? styles.rowDragOver : ''}`}
            draggable={draggable}
            onDragStart={
              draggable
                ? event => {
                    event.dataTransfer.setData('text/plain', item.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }
                : undefined
            }
            onDragOver={
              onReorder
                ? event => {
                    if (!event.dataTransfer.types.includes('text/plain')) return;
                    event.preventDefault();
                    setDragOverId(item.id);
                  }
                : undefined
            }
            onDragLeave={
              onReorder
                ? event => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setDragOverId(null);
                  }
                : undefined
            }
            onDrop={
              onReorder
                ? event => {
                    event.preventDefault();
                    const draggedId = event.dataTransfer.getData('text/plain');
                    setDragOverId(null);
                    if (draggedId && draggedId !== item.id) onReorder(draggedId, item.id);
                  }
                : undefined
            }
          >
            {onReorder && (
              <span className={styles.handle}>
                <Icon name="grip-vertical" />
              </span>
            )}
            <div className={styles.name}>{renderName(item)}</div>
            {renderCount && <span className={styles.count}>{renderCount(item)}</span>}
            {renderStatus && <span className={styles.status}>{renderStatus(item)}</span>}
            {renderActions && <div className={styles.actions}>{renderActions(item)}</div>}
          </div>
        );
      })}
    </div>
  );
}
