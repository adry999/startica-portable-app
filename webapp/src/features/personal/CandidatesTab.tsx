import { useMemo, useState } from 'react';
import { DataTable, EmptyState, ListToolbar, LoadingState, useToast } from '@shared/ui';
import { useCandidates, type CandidateFormInput } from './useCandidates';
import { buildCandidateColumns } from './candidateColumns';
import { CandidateFormDrawer } from './CandidateFormDrawer';
import type { Candidate } from '@shared/personal/personal.types';
import styles from './CandidatesTab.module.css';

export interface CandidatesTabProps {
  formTarget: Candidate | 'new' | null;
  onNew: () => void;
  onOpenRow: (candidate: Candidate) => void;
  onCloseForm: () => void;
}

function matches(candidate: Candidate, query: string): boolean {
  const haystack = [candidate.name, candidate.position, candidate.city, candidate.phone, candidate.notes]
    .join(' ')
    .toLocaleLowerCase('ro-RO');
  return haystack.includes(query);
}

/** Candidați (23l) — listă simplă de persoane de sunat; fără etape, filtre, stări sau legare de Echipă. */
export function CandidatesTab({ formTarget, onNew, onOpenRow, onCloseForm }: CandidatesTabProps) {
  const data = useCandidates();
  const toast = useToast();
  const [search, setSearch] = useState('');

  const sorted = useMemo(
    () => [...data.candidates].sort((a, b) => a.name.localeCompare(b.name, 'ro')),
    [data.candidates],
  );

  const query = search.trim().toLocaleLowerCase('ro-RO');
  const filtered = query ? sorted.filter(candidate => matches(candidate, query)) : sorted;

  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns = buildCandidateColumns();
  const trailing = query ? `${filtered.length} din ${sorted.length}` : `${sorted.length} persoane`;
  const searching = query.length > 0;

  async function handleSave(input: CandidateFormInput) {
    try {
      await data.saveCandidate(input);
      toast.show({ message: 'Candidatul a fost salvat.' });
      onCloseForm();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function handleDelete(id: string) {
    try {
      await data.deleteCandidate(id);
      toast.show({ message: 'Candidatul a fost șters.' });
      onCloseForm();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <div className={styles.root}>
      <ListToolbar
        search={{
          value: search,
          onChange: setSearch,
          ariaLabel: 'Caută candidat',
          placeholder: 'Caută candidat',
          className: styles.search,
        }}
        trailing={trailing}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={candidate => candidate.id}
        onRowClick={onOpenRow}
        empty="candidati.first"
        onEmptyAction={onNew}
        // Căutare fără rezultate — text propriu, generic pentru acest ecran, în afara catalogului
        // (empty-states.ts, header-ul fișierului: „Fără rezultate" are mereu prioritate); starea de
        // listă complet goală vine din DataTable + cheia candidati.first, mai sus.
        emptyState={
          searching ? <EmptyState variant="no-results" title="Nimeni nu se potrivește căutării." /> : undefined
        }
      />

      <CandidateFormDrawer target={formTarget} onSubmit={handleSave} onDelete={handleDelete} onClose={onCloseForm} />
    </div>
  );
}
