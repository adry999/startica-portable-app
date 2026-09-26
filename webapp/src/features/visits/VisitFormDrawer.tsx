import { useState, type FormEvent } from 'react';
import { Drawer } from '@shared/ui';
import { formatAge } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { defaultVisitFormValues, type VisitFormValues } from './visit-form';
import type { Group, Visit } from '@contracts/record-types.mjs';
import styles from './VisitFormDrawer.module.css';

export interface VisitFormDrawerProps {
  target: Visit | 'new' | null;
  groups: Group[];
  allowedNextStatuses: (status: Visit['status']) => Visit['status'][];
  /** Data preselectată la creare (ex. ziua aleasă în calendar) — ignorată la editare, unde data vizitei existente rămâne sursa. */
  defaultDate?: string;
  onSubmit: (values: VisitFormValues) => void;
  onClose: () => void;
}

/** Echivalentul visit-editor-fields.mjs's `markup()`/`read()`, ca formular React controlat. */
export function VisitFormDrawer({
  target,
  groups,
  allowedNextStatuses,
  defaultDate,
  onSubmit,
  onClose,
}: VisitFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<VisitFormValues>(() =>
    defaultVisitFormValues(editing, defaultDate || todayFn()),
  );

  function setField<K extends keyof VisitFormValues>(key: K, value: VisitFormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  const statusChoices = editing ? [editing.status, ...allowedNextStatuses(editing.status)] : [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: vizită' : 'Adaugă: vizită'}
      width={620}
      onClose={onClose}
      footer={
        <button type="submit" form="visit-form" className={styles.btnPrimary}>
          Salvează
        </button>
      }
    >
      <form id="visit-form" className={styles.form} onSubmit={handleSubmit}>
        <fieldset className={styles.section}>
          <legend>Vizita</legend>
          <label className={styles.field}>
            Data vizitei
            <input required type="date" value={values.date} onChange={event => setField('date', event.target.value)} />
          </label>
          <label className={styles.field}>
            Ora vizitei
            <input required type="time" value={values.time} onChange={event => setField('time', event.target.value)} />
          </label>
          {editing && (
            <label className={styles.field}>
              Statut
              <select value={values.status} onChange={event => setField('status', event.target.value)}>
                {statusChoices.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          )}
          {editing && <p className={styles.notice}>Schimbarea datei sau orei reprogramează vizita.</p>}
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Copil</legend>
          <label className={styles.field}>
            Nume copil
            <input required value={values.name} onChange={event => setField('name', event.target.value)} />
          </label>
          <label className={styles.field}>
            Data nașterii
            <input type="date" value={values.birthDate} onChange={event => setField('birthDate', event.target.value)} />
            <small className={styles.hint}>Vârstă: {formatAge(values.birthDate)}</small>
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Părinți</legend>
          <label className={styles.field}>
            Părinte 1
            <input required value={values.parent} onChange={event => setField('parent', event.target.value)} />
          </label>
          <label className={styles.field}>
            Telefon părinte 1
            <input
              required
              type="tel"
              value={values.phone}
              onChange={event => setField('phone', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Părinte 2 (opțional)
            <input value={values.parent2} onChange={event => setField('parent2', event.target.value)} />
          </label>
          <label className={styles.field}>
            Telefon părinte 2 (opțional)
            <input type="tel" value={values.phone2} onChange={event => setField('phone2', event.target.value)} />
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Dorințe</legend>
          <label className={styles.field}>
            Data dorită de start
            <input
              type="date"
              value={values.desiredStartDate}
              onChange={event => setField('desiredStartDate', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Grupa dorită
            <select value={values.desiredGroupId} onChange={event => setField('desiredGroupId', event.target.value)}>
              <option value="">Fără preferință</option>
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
            Cum a aflat de grădiniță
            <input value={values.source} onChange={event => setField('source', event.target.value)} />
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Date medicale</legend>
          <label className={styles.field}>
            Date medicale
            <textarea
              rows={3}
              value={values.healthNotes}
              onChange={event => setField('healthNotes', event.target.value)}
            />
          </label>
          <p className={styles.notice}>
            Date sensibile: nu apar în export și în istoric; se șterg automat la 12 luni de la ultima schimbare de
            statut.
          </p>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>După vizită</legend>
          <label className={styles.field}>
            Observații după vizită
            <textarea
              rows={3}
              value={values.postVisitNotes}
              onChange={event => setField('postVisitNotes', event.target.value)}
            />
          </label>
        </fieldset>

        <label className={styles.field}>
          Observații
          <textarea rows={3} value={values.notes} onChange={event => setField('notes', event.target.value)} />
        </label>
      </form>
    </Drawer>
  );
}
