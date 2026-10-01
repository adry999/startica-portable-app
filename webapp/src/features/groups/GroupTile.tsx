import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon, RowMenu, SelectableTile } from '@shared/ui';
import { initials } from '@shared/format/initials';
import { attachRotatedDragImage, GROUP_DRAG_TYPE } from './dragTypes';
import { BOARD_TONE_COLORS } from './groupBoardTone';
import { capacityPillLabel } from './groupStatePill';
import type { GroupCardView } from './useGroups';
import styles from './GroupTile.module.css';

export interface GroupTileProps {
  group: GroupCardView;
  busy: boolean;
  dragOver: boolean;
  onDragOverTile: () => void;
  onDragLeaveTile: () => void;
  onDropChild: (childId: string) => void;
  onDropGroup: (draggedGroupId: string) => void;
  onMove: (direction: -1 | 1) => void;
  onExpandOverflow?: () => void;
  /** „Editează”, numele grupei sau „+N” duc toate în Carduri, cu grupa selectată (03-grupe.md §4). */
  onEdit?: () => void;
  onOpenStickers?: () => void;
}

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[1][0]}.`;
}

/** Tile-ul unei grupe din Tablă (03-grupe.md §4) — nume, stare, ocupare, copii ca pastile. */
export function GroupTile({
  group,
  busy,
  dragOver,
  onDragOverTile,
  onDragLeaveTile,
  onDropChild,
  onDropGroup,
  onMove,
  onExpandOverflow,
  onEdit,
  onOpenStickers,
}: GroupTileProps) {
  const colors = BOARD_TONE_COLORS[group.tone];
  const pillLabel = capacityPillLabel(group);
  const overCapacity = group.capacityState === 'over';
  const visibleMembers = group.members.slice(0, 9);
  const extra = Math.max(0, group.memberCount - 9);
  const tileRef = useRef<HTMLDivElement>(null);
  const [beingDragged, setBeingDragged] = useState(false);

  function handleHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(1);
    }
  }

  return (
    <div
      ref={tileRef}
      className={`${styles.tile} ${dragOver ? styles.dragOver : ''} ${beingDragged ? styles.beingDragged : ''}`}
      style={{ background: colors.soft, color: colors.ink, ['--tone-bar' as string]: colors.bar }}
      onDragOver={event => {
        event.preventDefault();
        onDragOverTile();
      }}
      onDragLeave={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragLeaveTile();
      }}
      onDrop={event => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(GROUP_DRAG_TYPE))
          onDropGroup(event.dataTransfer.getData(GROUP_DRAG_TYPE));
        else onDropChild(event.dataTransfer.getData('text/plain'));
      }}
    >
      <div className={styles.head}>
        <SelectableTile
          className={styles.handle}
          draggable={!busy}
          aria-label={`Mută grupa ${group.name}`}
          onKeyDown={handleHandleKeyDown}
          onDragStart={event => {
            event.dataTransfer.setData(GROUP_DRAG_TYPE, group.id);
            event.dataTransfer.effectAllowed = 'move';
            if (tileRef.current) attachRotatedDragImage(event, tileRef.current);
            setBeingDragged(true);
          }}
          onDragEnd={() => setBeingDragged(false)}
        >
          <Icon name="grip-vertical" />
        </SelectableTile>
        {onEdit ? (
          <SelectableTile className={styles.name} onClick={onEdit}>
            {group.name}
          </SelectableTile>
        ) : (
          <p className={styles.name}>{group.name}</p>
        )}
        {onEdit && (
          <SelectableTile
            className={styles.editButton}
            style={{ color: colors.ink }}
            onClick={onEdit}
            aria-label={`Editează grupa ${group.name}`}
          >
            Editează
          </SelectableTile>
        )}
        {pillLabel && (
          <span
            className={styles.pill}
            style={overCapacity ? { background: 'var(--pink-ink)', color: 'var(--white)' } : { color: colors.ink }}
          >
            {pillLabel}
          </span>
        )}
        <strong className={styles.occupancy}>
          {group.memberCount}
          <span className={styles.occupancyTotal}>/{group.capacity ?? '—'}</span>
        </strong>
        {onOpenStickers && (
          <RowMenu
            items={[{ label: 'Stickere pentru grupă', onClick: onOpenStickers }]}
            ariaLabel={`Acțiuni grupa ${group.name}`}
          />
        )}
      </div>
      <div className={styles.bar}>
        {group.capacity != null && (
          <span
            style={{ width: `${group.occupancyPercent}%`, background: overCapacity ? 'var(--pink-ink)' : colors.bar }}
          />
        )}
      </div>
      <p className={styles.meta}>
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
      </p>
      {group.memberCount === 0 ? (
        <div className={styles.placeholder}>Plasează aici</div>
      ) : (
        <div className={styles.childRow}>
          {visibleMembers.map(member => (
            <span
              key={member.id}
              className={styles.childPill}
              draggable={!busy}
              onDragStart={event => {
                event.dataTransfer.setData('text/plain', member.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className={styles.childAvatar}>{initials(member.name)}</span>
              {firstNameLastInitial(member.name)}
            </span>
          ))}
          {extra > 0 && (
            <SelectableTile className={styles.moreButton} onClick={onExpandOverflow}>
              +{extra}
            </SelectableTile>
          )}
        </div>
      )}
    </div>
  );
}
