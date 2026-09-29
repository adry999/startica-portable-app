import { useEffect, useState } from 'react';
import { Button, MonthStepper, SegmentedControl, useTopbarActions } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Staff, Candidate } from '@shared/personal/personal.types';
import { TeamView } from './TeamView';
import { TimesheetView } from './TimesheetView';
import { LeavesView } from './LeavesView';
import { SalariesView, previousMonth } from './SalariesView';
import { CandidatesTab } from './CandidatesTab';
import styles from './PersonalPage.module.css';

export type PersonalTab = 'echipa' | 'pontaj' | 'concedii' | 'salarii' | 'candidati';

const TAB_OPTIONS: { value: PersonalTab; label: string }[] = [
  { value: 'echipa', label: 'Echipa' },
  { value: 'pontaj', label: 'Pontaj' },
  { value: 'concedii', label: 'Concedii' },
  { value: 'salarii', label: 'Salarii' },
  { value: 'candidati', label: 'Candidați' },
];

export interface PersonalPageProps {
  month: string;
}

/** „Personal” (24) — Echipa (23a), Pontaj (23b), Concedii (23f), Salarii (23c, PIN), Candidați (23l). */
export function PersonalPage({ month }: PersonalPageProps) {
  const [tab, setTab] = usePersistedState<PersonalTab>('view.personal', 'echipa');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pontaj (23b) își plimbă propria lună, independent de luna aplicației.
  const [pontajMonth, setPontajMonth] = useState(month.slice(0, 7));
  // Salarii (23c) arată implicit luna trecută (deja încheiată); stepperul permite orice lună
  // încheiată, dar nu luna curentă (pay() o refuză — absențele ei nu sunt încă definitive).
  const [salariesMonth, setSalariesMonth] = useState(previousMonth(month.slice(0, 7)));
  // „Tipărește” doar deschide dialogul „Ce tipăresc?” — tipărirea în sine pornește la confirmarea
  // din dialog, în TimesheetView, nu la clicul din antet (M5: nu mai tipărește peste dialog).
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [staffFormTarget, setStaffFormTarget] = useState<Staff | 'new' | null>(null);
  const [candidateFormTarget, setCandidateFormTarget] = useState<Candidate | 'new' | null>(null);

  // „Vezi cu PIN →” din fișa angajatului (23j) trece direct pe fila Salarii.
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && TAB_OPTIONS.some(option => option.value === requestedTab)) setTab(requestedTab as PersonalTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function shiftPontajMonth(delta: number) {
    const [year, monthNumber] = pontajMonth.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1);
    setPontajMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  function shiftSalariesMonth(delta: number) {
    const [year, monthNumber] = salariesMonth.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const cap = previousMonth(month.slice(0, 7));
    if (next <= cap) setSalariesMonth(next);
  }

  // Un singur apel useTopbarActions (24-personal.md #4): comutatorul de file plus acțiunea
  // filei active, ca a doua chemare să nu-l suprascrie pe primul la schimbarea filei.
  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl ariaLabel="Filă Personal" value={tab} onChange={setTab} options={TAB_OPTIONS} />
      {tab === 'echipa' && <Button onClick={() => setStaffFormTarget('new')}>+ Angajat</Button>}
      {tab === 'candidati' && <Button onClick={() => setCandidateFormTarget('new')}>+ Candidat</Button>}
      {tab === 'pontaj' && (
        <>
          <MonthStepper value={pontajMonth} onPrev={() => shiftPontajMonth(-1)} onNext={() => shiftPontajMonth(1)} />
          <Button variant="outline" onClick={() => setPrintDialogOpen(true)}>
            Tipărește
          </Button>
        </>
      )}
      {tab === 'salarii' && (
        <MonthStepper
          value={salariesMonth}
          onPrev={() => shiftSalariesMonth(-1)}
          onNext={() => shiftSalariesMonth(1)}
        />
      )}
    </div>,
  );

  if (tab === 'pontaj')
    return (
      <TimesheetView
        month={pontajMonth}
        printDialogOpen={printDialogOpen}
        onPrintDialogClose={() => setPrintDialogOpen(false)}
      />
    );
  if (tab === 'concedii') return <LeavesView />;
  if (tab === 'salarii') return <SalariesView month={salariesMonth} />;
  if (tab === 'candidati')
    return (
      <CandidatesTab
        formTarget={candidateFormTarget}
        onNew={() => setCandidateFormTarget('new')}
        onOpenRow={candidate => setCandidateFormTarget(candidate)}
        onCloseForm={() => setCandidateFormTarget(null)}
      />
    );
  return (
    <TeamView
      onOpenStaff={id => navigate(`/personal/${id}`)}
      staffFormTarget={staffFormTarget}
      onCloseStaffForm={() => setStaffFormTarget(null)}
    />
  );
}
