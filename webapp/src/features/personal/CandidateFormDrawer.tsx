import { useRef, useState, type FormEvent } from 'react';
import { Button, ConfirmDeleteDialog, Drawer, Field, NumberInput, PhoneInput, TextArea, TextInput } from '@shared/ui';
import { useUnsavedChangesGuard } from '@shared/state/useUnsavedChangesGuard';
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
  // 40c: × / Esc / fundalul Drawer-ului trec prin `requestClose`, nu direct prin `onClose`.
  const unsavedGuard = useUnsavedChangesGuard({
    dirty,
    label: 'un candidat',
    formName: editing ? 'candidatul' : 'candidatul nou',
    save: submitForm,
    onClose,
  });

  return (
    <>
      <Drawer
        open={target !== null}
        title={editing ? 'Editează: candidat' : 'Adaugă: candidat'}
        size="detail"
        onClose={unsavedGuard.requestClose}
        onCancel={unsavedGuard.requestClose}
        footerStart={
          editing && (
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(true)}>
              Șterge
            </Button>
          )
        }
        primary={
          !name.trim()
            ? {
                label: 'Salvează',
                form: 'candidate-form-drawer',
                disabled: true,
                disabledReason: 'Scrie numele candidatului',
              }
            : { label: 'Salvează', form: 'candidate-form-drawer', loading: submitting }
        }
      >
        <form id="candidate-form-drawer" className={styles.form} autoComplete="off" onSubmit={handleSubmit}>
          <Field label="Nume, prenume" htmlFor="candidate-name">
            <TextInput id="candidate-name" required value={name} onChange={setName} />
          </Field>
          <div className={`${styles.row} ${styles.rowNarrow}`}>
            <Field label="Poziție" htmlFor="candidate-position">
              <TextInput id="candidate-position" value={position} onChange={setPosition} />
            </Field>
            <Field label="Vârstă" htmlFor="candidate-age">
              <NumberInput id="candidate-age" min={0} max={120} value={age} onChange={setAge} />
            </Field>
          </div>
          <Field label="Experiență" htmlFor="candidate-experience">
            <TextInput id="candidate-experience" value={experience} onChange={setExperience} />
          </Field>
          <div className={styles.row}>
            <Field label="Unde locuiește" htmlFor="candidate-city">
              <TextInput id="candidate-city" value={city} onChange={setCity} />
            </Field>
            <Field label="Telefon" htmlFor="candidate-phone">
              <PhoneInput id="candidate-phone" value={phone} onChange={setPhone} />
            </Field>
          </div>
          <Field label="Notițe" htmlFor="candidate-notes">
            <TextArea id="candidate-notes" rows={5} value={notes} onChange={setNotes} />
          </Field>
        </form>
      </Drawer>
      {unsavedGuard.confirmDialog}

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
