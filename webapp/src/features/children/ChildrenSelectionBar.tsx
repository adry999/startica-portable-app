import { RowMenu, SelectionBar } from '@shared/ui';
import type { Group } from '@contracts/record-types.mjs';
import type { ArchiveFilter } from './ChildrenToolbar';
import styles from './ChildrenPage.module.css';

export interface ChildrenSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  groups: Group[];
  onMove: (groupId: string) => void;
  onExport: () => void;
  archiveFilter: ArchiveFilter;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function ChildrenSelectionBar({
  selectedCount,
  onCancel,
  groups,
  onMove,
  onExport,
  archiveFilter,
  onArchive,
  onUnarchive,
}: ChildrenSelectionBarProps) {
  return (
    <SelectionBar label={<>{selectedCount} selectați</>} onCancel={onCancel}>
      <RowMenu
        ariaLabel="Mută în grupă"
        trigger="Mută în grupă"
        items={[
          { label: 'Fără grupă', onClick: () => onMove('__none__') },
          ...groups.map(group => ({ label: group.name, onClick: () => onMove(group.id) })),
        ]}
      />
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
