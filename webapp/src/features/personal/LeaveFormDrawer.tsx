import { useState } from 'react';
import { Button, ConfirmDeleteDialog, Drawer, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Leave, LeaveType, Staff } from '@shared/personal/personal.types';
import styles from './LeaveFormDrawer.module.css';

export interface LeaveFormDrawerProps {
  target: Leave | 'new' | null;
  staff: Staff[];
  onClose: () => void;
  onSubmit: (leave: Leave) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'CO', label: 'Concediu de odihnă' },
  { value: 'CM', label: 'Concediu medical' },
  { value: 'FP', label: 'Fără plată' },
];

/** Formular concediu (23f) — angajat, tip, interval, planificat, notă; editare + ștergere la clic pe bară. */
export function LeaveFormDrawer({ target, staff, onClose, onSubmit, onDelete }: LeaveFormDrawerProps) {
  const toast = useToast();
  const editing = target !== null && target !== 'new' ? target : null;
  const staffSorted = [...staff].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const [staffId, setStaffId] = useState(editing?.staffId ?? staffSorted[0]?.id ?? '');
  const [type, setType] = useState<LeaveType>(editing?.type ?? 'CO');
  const [from, setFrom] = useState(editing?.from ?? today());
  const [to, setTo] = useState(editing?.to ?? today());
  const [planned, setPlanned] = useState(editing?.planned ?? false);
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function handleSubmit() {
    if (submitting || !staffId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: editing?.id ?? `LV-${crypto.randomUUID()}`,
        staffId,
        from,
        to,
        type,
        planned,
        note: note || undefined,
      });
      toast.show({ message: 'Concediul a fost salvat.' });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    try {
      await onDelete(editing.id);
      toast.show({ message: 'Concediul a fost șters.' });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <Drawer
        open={target !== null}
        title={editing ? 'Editează: concediu' : 'Adaugă: concediu'}
        width={480}
        onClose={onClose}
        footer={
          <div className={styles.footer}>
            <div>
              {editing && (
                <Button variant="ghost" onClick={() => setConfirmDeleteOpen(true)}>
                  Șterge
                </Button>
              )}
            </div>
            <div className={styles.footerRight}>
              <Button variant="outline" onClick={onClose}>
                Anulează
              </Button>
              <Button type="submit" form="leave-form-drawer" disabled={submitting}>
                Salvează
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="leave-form-drawer"
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label className={styles.field}>
            Angajat
            <select required value={staffId} onChange={event => setStaffId(event.target.value)}>
              {staffSorted.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Tip
            <select value={type} onChange={event => setType(event.target.value as LeaveType)}>
              {LEAVE_TYPES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            De la
            <input required type="date" value={from} onChange={event => setFrom(event.target.value)} />
          </label>
          <label className={styles.field}>
            Până la
            <input required type="date" value={to} onChange={event => setTo(event.target.value)} />
          </label>
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={planned} onChange={event => setPlanned(event.target.checked)} />
            Planificat (viitor)
          </label>
          <label className={styles.field}>
            Notă
            <textarea rows={2} value={note} onChange={event => setNote(event.target.value)} />
          </label>
        </form>
      </Drawer>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        title="Ștergi concediul?"
        description={
          editing
            ? `Concediul lui „${staff.find(person => person.id === editing.staffId)?.name ?? ''}” va fi șters definitiv.`
            : ''
        }
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void handleDelete();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
