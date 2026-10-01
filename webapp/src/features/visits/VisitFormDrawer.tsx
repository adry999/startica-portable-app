import { useRef, useState, type FormEvent } from 'react';
import { Button, DateInput, Drawer, Field, PhoneInput, Select, TextArea, TextInput, TimeInput } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { formatAge } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { defaultVisitFormValues, STATUS_LABEL, type VisitFormValues } from './visit-form';
import type { Group, Visit } from '@contracts/record-types.mjs';
import styles from './VisitFormDrawer.module.css';

export interface VisitFormDrawerProps {
  target: Visit | 'new' | null;
  groups: Group[];
  /** Data preselectată la creare (ex. ziua aleasă în calendar) — ignorată la editare, unde data vizitei existente rămâne sursa. */
  defaultDate?: string;
  onSubmit: (values: VisitFormValues) => void;
  onClose: () => void;
}

// Corectare manuală a unei greșeli de introducere — orice statut din acest set poate fi
// ales liber la editare, spre diferență de allowedNextStatuses (tranziția înainte impusă
// pe butoanele rapide „Cum a decurs vizita?"). „Înscris" nu e aici: are drept sursă unică
// fluxul de înscriere (creează fișa copilului), nu poate fi setat direct dintr-un dropdown.
const CORRECTABLE_STATUSES: Visit['status'][] = ['Programată', 'Efectuată', 'Neprezentată', 'Renunțat'];

export function VisitFormDrawer({ target, groups, defaultDate, onSubmit, onClose }: VisitFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<VisitFormValues>(() =>
    defaultVisitFormValues(editing, defaultDate || todayFn()),
  );
  // Valorile de la montare — comparate cu cele curente pentru garda de formular nesalvat (13b).
  const initialValuesRef = useRef(values);

  function setField<K extends keyof VisitFormValues>(key: K, value: VisitFormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  // Reprogramarea (dată/oră diferite de ale vizitei salvate) resetează statutul la
  // Programată în backend (rescheduleVisit), necondiționat — dacă lăsam Statut pe vechea
  // valoare presetată, salvarea o re-aplica tăcut peste reprogramare, fără ca cineva să
  // aleagă asta. Reflectăm reset-ul direct în formular, ca ce se vede să fie ce se salvează.
  function setDateOrTime<K extends 'date' | 'time'>(key: K, value: string) {
    setValues(previous => {
      const next = { ...previous, [key]: value };
      if (editing && editing.status !== 'Înscris') {
        next.status = next.date !== editing.date || next.time !== editing.time ? 'Programată' : editing.status;
      }
      return next;
    });
  }

  const statusChoices = editing ? (editing.status === 'Înscris' ? ['Înscris' as const] : CORRECTABLE_STATUSES) : [];

  // onSubmit e sincron (fire-and-forget, vezi VisitsPage.submitVisitForm) — folosită și pentru
  // save() din dirty-forms (13b).
  function submitForm(): Promise<boolean> {
    onSubmit(values);
    return Promise.resolve(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitForm();
  }

  const dirty = target !== null && JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'o vizită', save: submitForm } : null);

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: vizită' : 'Adaugă: vizită'}
      width={620}
      onClose={onClose}
      footer={
        <Button type="submit" form="visit-form">
          Salvează
        </Button>
      }
    >
      <form id="visit-form" className={styles.form} autoComplete="off" onSubmit={handleSubmit}>
        <fieldset className={styles.section}>
          <legend>Vizita</legend>
          <Field label="Data vizitei" htmlFor="visit-date">
            <DateInput id="visit-date" required value={values.date} onChange={value => setDateOrTime('date', value)} />
          </Field>
          <Field label="Ora vizitei" htmlFor="visit-time">
            <TimeInput id="visit-time" required value={values.time} onChange={value => setDateOrTime('time', value)} />
          </Field>
          {editing && (
            <Field label="Statut" htmlFor="visit-status">
              <Select
                id="visit-status"
                value={values.status}
                onChange={value => setField('status', value)}
                options={statusChoices.map(status => ({ value: status, label: STATUS_LABEL[status] }))}
              />
            </Field>
          )}
          {editing && <p className={styles.notice}>Schimbarea datei sau orei reprogramează vizita.</p>}
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Copil</legend>
          <Field label="Nume copil" htmlFor="visit-child-name">
            <TextInput id="visit-child-name" required value={values.name} onChange={value => setField('name', value)} />
          </Field>
          <Field
            label="Data nașterii"
            htmlFor="visit-child-birth-date"
            hint={values.birthDate ? `Vârstă: ${formatAge(values.birthDate)}` : undefined}
          >
            <DateInput
              id="visit-child-birth-date"
              value={values.birthDate}
              onChange={value => setField('birthDate', value)}
            />
          </Field>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Părinți</legend>
          <Field label="Părinte 1" htmlFor="visit-parent1-name">
            <TextInput
              id="visit-parent1-name"
              required
              value={values.parent}
              onChange={value => setField('parent', value)}
            />
          </Field>
          <Field label="Telefon părinte 1" htmlFor="visit-parent1-phone">
            <PhoneInput id="visit-parent1-phone" value={values.phone} onChange={value => setField('phone', value)} />
          </Field>
          <Field label="Părinte 2 (opțional)" htmlFor="visit-parent2-name">
            <TextInput id="visit-parent2-name" value={values.parent2} onChange={value => setField('parent2', value)} />
          </Field>
          <Field label="Telefon părinte 2 (opțional)" htmlFor="visit-parent2-phone">
            <PhoneInput id="visit-parent2-phone" value={values.phone2} onChange={value => setField('phone2', value)} />
          </Field>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Dorințe</legend>
          <Field label="Data dorită de start" htmlFor="visit-desired-start-date">
            <DateInput
              id="visit-desired-start-date"
              value={values.desiredStartDate}
              onChange={value => setField('desiredStartDate', value)}
            />
          </Field>
          <Field label="Grupa dorită" htmlFor="visit-desired-group">
            <Select
              id="visit-desired-group"
              value={values.desiredGroupId}
              onChange={value => setField('desiredGroupId', value)}
              placeholder="Fără preferință"
              options={[...groups]
                .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
                .map(group => ({ value: group.id, label: group.name }))}
            />
          </Field>
          <Field label="Cum a aflat de grădiniță" htmlFor="visit-source">
            <TextInput id="visit-source" value={values.source} onChange={value => setField('source', value)} />
          </Field>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Date medicale</legend>
          <Field label="Date medicale" htmlFor="visit-health-notes">
            <TextArea
              id="visit-health-notes"
              rows={3}
              value={values.healthNotes}
              onChange={value => setField('healthNotes', value)}
            />
          </Field>
          <p className={styles.notice}>
            Date sensibile: nu apar în export și în istoric; se șterg automat la 12 luni de la ultima schimbare de
            statut.
          </p>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>După vizită</legend>
          <Field label="Observații după vizită" htmlFor="visit-post-visit-notes">
            <TextArea
              id="visit-post-visit-notes"
              rows={3}
              value={values.postVisitNotes}
              onChange={value => setField('postVisitNotes', value)}
            />
          </Field>
        </fieldset>

        <Field label="Observații" htmlFor="visit-notes">
          <TextArea id="visit-notes" rows={3} value={values.notes} onChange={value => setField('notes', value)} />
        </Field>
      </form>
    </Drawer>
  );
}
