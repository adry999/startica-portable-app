import { useEffect } from 'react';
import { SegmentedControl, useTopbarActions } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TeamView } from './TeamView';
import { TimesheetView } from './TimesheetView';
import { LeavesView } from './LeavesView';
import { SalariesView } from './SalariesView';

export type PersonalTab = 'echipa' | 'pontaj' | 'concedii' | 'salarii';

const TAB_OPTIONS: { value: PersonalTab; label: string }[] = [
  { value: 'echipa', label: 'Echipa' },
  { value: 'pontaj', label: 'Pontaj' },
  { value: 'concedii', label: 'Concedii' },
  { value: 'salarii', label: 'Salarii' },
];

export interface PersonalPageProps {
  month: string;
}

/** „Personal” (24) — Echipa (23a), Pontaj (23b), Concedii (23f), Salarii (23c, PIN). */
export function PersonalPage({ month }: PersonalPageProps) {
  const [tab, setTab] = usePersistedState<PersonalTab>('view.personal', 'echipa');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // „Vezi cu PIN →” din fișa angajatului (23j) trece direct pe fila Salarii.
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && TAB_OPTIONS.some(option => option.value === requestedTab)) setTab(requestedTab as PersonalTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useTopbarActions(
    <SegmentedControl ariaLabel="Filă Personal" value={tab} onChange={setTab} options={TAB_OPTIONS} />,
  );

  if (tab === 'pontaj') return <TimesheetView month={month} />;
  if (tab === 'concedii') return <LeavesView />;
  if (tab === 'salarii') return <SalariesView />;
  return <TeamView onOpenStaff={id => navigate(`/personal/${id}`)} />;
}
