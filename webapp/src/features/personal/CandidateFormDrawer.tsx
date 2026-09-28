import { useRef, useState, type FormEvent } from 'react';
import { Button, ConfirmDeleteDialog, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import type { CandidateFormInput } from './useCandidates';
import type { Candidate } from '@shared/personal/personal.types';
import styles from './CandidateFormDrawer.module.css';

export interface CandidateFormDrawerProps {
  target: Candidate | 'new' | null;
  onSubmit: (input: CandidateFormInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

/** Drawer 480px pentru un candidat (§23l) — fără PIN, fără flux de angajare. */
export function CandidateFormDrawer({ target, onSubmit, onDelete, onClose }: CandidateFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [position, setPosition] = useState(editing?.position ?? '');
  const [age, setAge] = useState(editing?.age != null ? String(editing.age) : '');
  const [experience, setExperience] = useState(editing?.experience ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const initialValuesRef = useRef({ name, position, age, experience, city, phone, notes });

  async function submitForm(): Promise<boolean> {
    if (submitting || !name.trim()) return false;
    setSubmitting(true);
    try {
      await onSubmit({
        id: editing?.id,
        name: name.trim(),
        position: position.trim(),
        age: age.trim() ? Number(age) : null,
        experience: experience.trim(),
        city: city.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      });
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitForm();
  }

  const currentValues = { name, position, age, experience, city, phone, notes };
  const dirty = target !== null && JSON.stringify(currentValues) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'un candidat', save: submitForm } : null);

  return (
    <>
      <Drawer
        open={target !== null}
        title={editing ? 'Editează: candidat' : 'Adaugă: candidat'}
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
              <Button type="submit" form="candidate-form-drawer" disabled={submitting || !name.trim()}>
                Salvează
              </Button>
            </div>
          </div>
        }
      >
        <form id="candidate-form-drawer" className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Nume, prenume
            <input autoFocus required type="text" value={name} onChange={event => setName(event.target.value)} />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              Poziție
              <input type="text" value={position} onChange={event => setPosition(event.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.narrow}`}>
              Vârstă
              <input type="number" min={0} max={120} value={age} onChange={event => setAge(event.target.value)} />
            </label>
          </div>
          <label className={styles.field}>
            Experiență
            <input type="text" value={experience} onChange={event => setExperience(event.target.value)} />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              Unde locuiește
              <input type="text" value={city} onChange={event => setCity(event.target.value)} />
            </label>
            <label className={styles.field}>
              Telefon
              <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} />
            </label>
          </div>
          <label className={styles.field}>
            Notițe
            <textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
        </form>
      </Drawer>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        title="Ștergi candidatul?"
        description={editing ? `„${editing.name}” va fi șters definitiv.` : ''}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (editing) void onDelete(editing.id);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
