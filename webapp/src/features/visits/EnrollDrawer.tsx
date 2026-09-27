import { useRef, useState } from 'react';
import { Button, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { formatDate } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Group, Visit } from '@contracts/record-types.mjs';
import styles from './VisitFormDrawer.module.css';

export interface EnrollDrawerProps {
  visit: Visit | null;
  groups: Group[];
  onSubmit: (overrides: { fee: string; groupId: string; attendanceDate: string }) => void;
  onClose: () => void;
}

/**
 * Simplificare deliberată față de legacy: legacy deschide editorul complet de copil,
 * precompletat din vizită, unde orice câmp poate fi corectat. Aici doar cele 3 câmpuri
 * pe care vizita nu le are deja (taxă, grupă finală, data de start) sunt editabile;
 * restul (nume, părinți, date medicale) vine exact din vizită, needitabil aici —
 * se corectează ulterior din fișa copilului, dacă e nevoie.
 */
export function EnrollDrawer({ visit, groups, onSubmit, onClose }: EnrollDrawerProps) {
  const [fee, setFee] = useState('');
  const [groupId, setGroupId] = useState(() => visit?.desiredGroupId ?? '');
  const [attendanceDate, setAttendanceDate] = useState(() => visit?.desiredStartDate || todayFn());
  // Valorile de la montare — comparate cu cele curente pentru garda de formular nesalvat (13b).
  const initialValuesRef = useRef({ fee, groupId, attendanceDate });

  // onSubmit e sincron (fire-and-forget, vezi VisitsPage.submitEnroll) — folosită și pentru
  // save() din dirty-forms (13b).
  function submitForm(): Promise<boolean> {
    onSubmit({ fee, groupId, attendanceDate });
    return Promise.resolve(true);
  }

  const currentValues = { fee, groupId, attendanceDate };
  const dirty = visit !== null && JSON.stringify(currentValues) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'o vizită', save: submitForm } : null);

  return (
    <Drawer
      open={visit !== null}
      title={visit ? `Înscrie copilul: ${visit.name}` : 'Înscrie copilul'}
      width={520}
      onClose={onClose}
      footer={<Button onClick={() => void submitForm()}>Înscrie</Button>}
    >
      <div className={styles.form}>
        <fieldset className={styles.section}>
          <legend>Din vizită</legend>
          <p className={styles.notice}>
            {visit?.name} · {visit?.parent}
            {visit?.phone ? ` · ${visit.phone}` : ''}
            {visit?.birthDate ? ` · născut(ă) ${formatDate(visit.birthDate)}` : ''}
          </p>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Fișa nouă</legend>
          <label className={styles.field}>
            Taxa lunară (gol = necunoscută)
            <input type="number" min={0} step="0.01" value={fee} onChange={event => setFee(event.target.value)} />
          </label>
          <label className={styles.field}>
            Grupă
            <select value={groupId} onChange={event => setGroupId(event.target.value)}>
              <option value="">Fără grupă</option>
              {[...groups]
                .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
                .map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.field}>
            Început frecventare
            <input type="date" value={attendanceDate} onChange={event => setAttendanceDate(event.target.value)} />
          </label>
        </fieldset>
      </div>
    </Drawer>
  );
}
