import { useState } from 'react';
import { Badge, Button, Card, useToast } from '@shared/ui';
import type { Staff } from '@shared/personal/personal.types';
import type { Group, GroupTeamMember } from '@contracts/record-types.mjs';
import styles from './GroupTeamCard.module.css';

export interface GroupTeamCardProps {
  group: Group;
  staff: Staff[];
  onSave: (team: GroupTeamMember[]) => Promise<void>;
}

const ROLE_LABEL: Record<GroupTeamMember['role'], string> = {
  principal: 'principal',
  asistent: 'asistent',
  inlocuitor: 'înlocuitor',
};
const DAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V'];

/** Echipa grupei (23i) — un singur principal, asistenți și înlocuitori, opțional cu zilele lor. */
export function GroupTeamCard({ group, staff, onSave }: GroupTeamCardProps) {
  const toast = useToast();
  const [team, setTeam] = useState<GroupTeamMember[]>(group.team ?? []);
  const [newStaffId, setNewStaffId] = useState('');
  const [newRole, setNewRole] = useState<GroupTeamMember['role']>('asistent');
  const [saving, setSaving] = useState(false);

  const staffById = new Map(staff.map(person => [person.id, person]));
  const availableStaff = staff.filter(person => !person.archivedAt && !team.some(entry => entry.staffId === person.id));

  function addEntry() {
    if (!newStaffId) return;
    if (newRole === 'principal' && team.some(entry => entry.role === 'principal')) {
      toast.show({ message: 'Grupa are deja un principal — redenumește-l pe cel actual mai întâi.' });
      return;
    }
    setTeam(previous => [...previous, { staffId: newStaffId, role: newRole }]);
    setNewStaffId('');
  }

  function removeEntry(staffId: string) {
    setTeam(previous => previous.filter(entry => entry.staffId !== staffId));
  }

  function toggleDay(staffId: string, day: number) {
    setTeam(previous =>
      previous.map(entry => {
        if (entry.staffId !== staffId) return entry;
        const days = entry.days ?? [];
        const nextDays = days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort();
        return { ...entry, days: nextDays };
      }),
    );
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(team);
      toast.show({ message: 'Echipa grupei a fost salvată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={styles.root}>
      <p className={styles.title}>Echipa grupei</p>

      {team.length === 0 && <p className={styles.notice}>Nicio persoană asignată.</p>}

      <ul className={styles.list}>
        {team.map(entry => {
          const person = staffById.get(entry.staffId);
          return (
            <li key={entry.staffId} className={styles.row}>
              <span className={styles.name}>{person?.name ?? entry.staffId}</span>
              <Badge tone={entry.role === 'principal' ? 'orange' : entry.role === 'asistent' ? 'mint' : 'neutral'}>
                {ROLE_LABEL[entry.role]}
              </Badge>
              <span className={styles.days}>
                {DAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={(entry.days ?? []).includes(index + 1) ? styles.dayActive : styles.day}
                    onClick={() => toggleDay(entry.staffId, index + 1)}
                  >
                    {label}
                  </button>
                ))}
              </span>
              <button type="button" className={styles.removeButton} onClick={() => removeEntry(entry.staffId)}>
                Scoate
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.addRow}>
        <select value={newStaffId} onChange={event => setNewStaffId(event.target.value)}>
          <option value="">Alege angajat…</option>
          {availableStaff.map(person => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <select value={newRole} onChange={event => setNewRole(event.target.value as GroupTeamMember['role'])}>
          <option value="principal">principal</option>
          <option value="asistent">asistent</option>
          <option value="inlocuitor">înlocuitor</option>
        </select>
        <button type="button" onClick={addEntry} disabled={!newStaffId}>
          + Adaugă
        </button>
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        Salvează echipa
      </Button>
    </Card>
  );
}
