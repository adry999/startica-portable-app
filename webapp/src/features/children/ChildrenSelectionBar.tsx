import { SearchSelect, SelectionBar } from '@shared/ui';
import type { Group } from '@contracts/record-types.mjs';
import type { ArchiveFilter } from './ChildrenToolbar';
import styles from './ChildrenPage.module.css';

export interface ChildrenSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  moveGroupId: string;
  onMoveGroupIdChange: (value: string) => void;
  groups: Group[];
  onMove: () => void;
  onExport: () => void;
  archiveFilter: ArchiveFilter;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function ChildrenSelectionBar({
  selectedCount,
  onCancel,
  moveGroupId,
  onMoveGroupIdChange,
  groups,
  onMove,
  onExport,
  archiveFilter,
  onArchive,
  onUnarchive,
}: ChildrenSelectionBarProps) {
  return (
    <SelectionBar label={<>{selectedCount} selectați</>} onCancel={onCancel}>
      <span className={styles.selectionDivider}>|</span>
      <SearchSelect
        className={styles.filterSelect}
        ariaLabel="Mută în grupa"
        placeholder="Mută în grupă…"
        value={moveGroupId}
        onChange={onMoveGroupIdChange}
        options={[
          { value: '__none__', label: 'Fără grupă' },
          ...groups.map(group => ({ value: group.id, label: group.name })),
        ]}
      />
      <button type="button" disabled={!moveGroupId} onClick={onMove}>
        Mută
      </button>
      <button type="button" onClick={onExport}>
        Exportă
      </button>
      {archiveFilter === 'archived' ? (
        <button type="button" className={styles.selectionArchive} onClick={onUnarchive}>
          Dezarhivează
        </button>
      ) : (
        <button type="button" className={styles.selectionArchive} onClick={onArchive}>
          Arhivează
        </button>
      )}
    </SelectionBar>
  );
}
