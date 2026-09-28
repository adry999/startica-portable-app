import { RowMenu } from '@shared/ui';
import { GROUP_DRAG_TYPE } from './dragTypes';
import { BOARD_TONE_COLORS } from './groupBoardTone';
import { capacityPillLabel } from './groupStatePill';
import type { GroupCardView } from './useGroups';
import styles from './GroupCardCompact.module.css';

export interface GroupCardCompactProps {
  group: GroupCardView;
  selected: boolean;
  busy: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onDragOverCard: () => void;
  onDragLeaveCard: () => void;
  onDropGroup: (draggedGroupId: string) => void;
  onOpenStickers?: () => void;
}

/** Cardul compact din Carduri (03-grupe.md §5) — selectabil, tras de tot cardul pentru reordonare. */
export function GroupCardCompact({
  group,
  selected,
  busy,
  dragOver,
  onSelect,
  onDragOverCard,
  onDragLeaveCard,
  onDropGroup,
  onOpenStickers,
}: GroupCardCompactProps) {
  const colors = BOARD_TONE_COLORS[group.tone];
  const pillLabel = capacityPillLabel(group);
  const overCapacity = group.capacityState === 'over';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${selected ? styles.selected : ''} ${dragOver ? styles.dragOver : ''}`}
      style={{ background: colors.soft, color: colors.ink, borderColor: selected ? colors.bar : 'transparent' }}
      draggable={!busy}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onDragStart={event => {
        event.dataTransfer.setData(GROUP_DRAG_TYPE, group.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(GROUP_DRAG_TYPE)) return;
        event.preventDefault();
        onDragOverCard();
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragLeaveCard();
      }}
      onDrop={event => {
        if (!event.dataTransfer.types.includes(GROUP_DRAG_TYPE)) return;
        event.preventDefault();
        onDropGroup(event.dataTransfer.getData(GROUP_DRAG_TYPE));
      }}
    >
      <span className={styles.handle} aria-hidden="true">
        ⋮⋮
      </span>
      {onOpenStickers && (
        <div className={styles.menu}>
          <RowMenu
            items={[{ label: 'Stickere pentru grupă', onClick: onOpenStickers }]}
            ariaLabel={`Acțiuni grupa ${group.name}`}
          />
        </div>
      )}
      <div className={styles.headRow}>
        <p className={styles.name}>{group.name}</p>
        <strong className={styles.occupancy}>{group.occupancyLabel}</strong>
      </div>
      <div className={styles.bar}>
        {group.capacity != null && (
          <span
            style={{ width: `${group.occupancyPercent}%`, background: overCapacity ? 'var(--pink-ink)' : colors.bar }}
          />
        )}
      </div>
      <div className={styles.metaRow}>
        <span className={styles.meta}>
          {group.educator ? group.educator : <span className={styles.noEducator}>Fără educator</span>} ·{' '}
          {group.ageRangeLabel}
        </span>
        {pillLabel && (
          <span
            className={styles.pill}
            style={overCapacity ? { background: 'var(--pink-ink)', color: 'var(--white)' } : { color: colors.ink }}
          >
            {pillLabel}
          </span>
        )}
      </div>
    </div>
  );
}
