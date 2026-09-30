import { useState } from 'react';
import { Icon, RowMenu } from '@shared/ui';
import { attachRotatedDragImage, GROUP_DRAG_TYPE } from './dragTypes';
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
  const [beingDragged, setBeingDragged] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${selected ? styles.selected : ''} ${dragOver ? styles.dragOver : ''} ${
        beingDragged ? styles.beingDragged : ''
      }`}
      style={{
        background: colors.soft,
        color: colors.ink,
        borderColor: selected || beingDragged ? colors.bar : 'transparent',
      }}
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
        attachRotatedDragImage(event, event.currentTarget);
        setBeingDragged(true);
      }}
      onDragEnd={() => setBeingDragged(false)}
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
      <div className={styles.headRow}>
        <span className={styles.handle} aria-hidden="true">
          <Icon name="grip-vertical" />
        </span>
        <p className={styles.name}>{group.name}</p>
        <strong className={styles.occupancy}>{group.occupancyLabel}</strong>
        {onOpenStickers && (
          <div className={styles.menu}>
            <RowMenu
              items={[{ label: 'Stickere pentru grupă', onClick: onOpenStickers }]}
              ariaLabel={`Acțiuni grupa ${group.name}`}
            />
          </div>
        )}
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
          {group.educator ? (
            group.educatorIsLegacy ? (
              <span className={styles.legacyEducator}>(din fișa veche) {group.educator}</span>
            ) : (
              group.educator
            )
          ) : (
            <span className={styles.noEducator}>Fără educator</span>
          )}{' '}
          · {group.ageRangeLabel}
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
