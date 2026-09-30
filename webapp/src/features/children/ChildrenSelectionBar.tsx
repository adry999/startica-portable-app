import { RowMenu, SelectionBar } from '@shared/ui';
import type { Group } from '@contracts/record-types.mjs';
import type { ArchiveFilter } from './ChildrenToolbar';

export interface ChildrenSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  groups: Group[];
  onMove: (groupId: string) => void;
  onExport: () => void;
  archiveFilter: ArchiveFilter;
  onArchive: () => void;
  onUnarchive: () => void;
  /** Toate rândurile selectate sunt arhivate — condiția din „Toate” pentru „Șterge definitiv” (B2). */
  allSelectedArchived: boolean;
  onDeleteForever: () => void;
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
  allSelectedArchived,
  onDeleteForever,
}: ChildrenSelectionBarProps) {
  // B2 (Formulare.dc.html#15h): „Șterge definitiv” apare în filtrul Arhivate mereu, în
  // Toate doar când toate rândurile selectate sunt arhivate, și niciodată în Active.
  const showDeleteForever = archiveFilter === 'archived' || (archiveFilter === 'all' && allSelectedArchived);
  return (
    <SelectionBar
      label={<>{selectedCount} selectați</>}
      onCancel={onCancel}
      actions={[
        { label: 'Exportă', onClick: onExport },
        archiveFilter === 'archived'
          ? { label: 'Dezarhivează', onClick: onUnarchive, tone: 'accent' }
          : { label: 'Arhivează', onClick: onArchive, tone: 'accent' },
      ]}
      danger={showDeleteForever ? { label: 'Șterge definitiv', onClick: onDeleteForever } : undefined}
    >
      <RowMenu
        ariaLabel="Mută în grupă"
        trigger="Mută în grupă"
        items={[
          { label: 'Fără grupă', onClick: () => onMove('__none__') },
          ...groups.map(group => ({ label: group.name, onClick: () => onMove(group.id) })),
        ]}
      />
    </SelectionBar>
  );
}
