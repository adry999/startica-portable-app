import { PersonCell, type DataTableColumn } from '@shared/ui';
import type { Candidate } from '@shared/personal/personal.types';
import styles from './CandidatesTab.module.css';

/** Coloanele §23l — sortare fixă alfabetică (fără `sortValue`, fără click-sort pe alte coloane). */
export function buildCandidateColumns(): DataTableColumn<Candidate>[] {
  return [
    {
      key: 'name',
      header: 'Nume, prenume',
      render: candidate => <PersonCell name={candidate.name} />,
    },
    {
      key: 'position',
      header: 'Poziție',
      render: candidate => candidate.position || '—',
    },
    {
      key: 'age',
      header: 'Vârstă',
      render: candidate => (candidate.age != null ? String(candidate.age) : '—'),
    },
    {
      key: 'experience',
      header: 'Experiență',
      render: candidate => candidate.experience || '—',
    },
    {
      key: 'city',
      header: 'Unde locuiește',
      render: candidate => candidate.city || '—',
    },
    {
      key: 'phone',
      header: 'Telefon',
      render: candidate => (candidate.phone ? <span className={styles.phone}>{candidate.phone}</span> : '—'),
    },
    {
      key: 'notes',
      header: 'Notițe',
      render: candidate =>
        candidate.notes ? (
          <span className={styles.notes}>{candidate.notes}</span>
        ) : (
          <span className={styles.empty}>—</span>
        ),
    },
  ];
}
