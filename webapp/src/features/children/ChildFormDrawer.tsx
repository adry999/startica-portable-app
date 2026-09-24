import { useState } from 'react';
import { Drawer } from '@shared/ui';
import { formatAge } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { CHILD_STATUSES, defaultChildFormValues, type ChildFormValues } from './child-form';
import type { Child, Group } from '@contracts/record-types.mjs';
import styles from './ChildFormDrawer.module.css';

export interface ChildFormDrawerProps {
  target: Child | 'new' | null;
  groups: Group[];
  onSubmit: (values: ChildFormValues) => void;
  onClose: () => void;
}

/** Echivalentul child-editor-fields.mjs's `markup()`/`bind()`, ca formular React controlat. */
export function ChildFormDrawer({ target, groups, onSubmit, onClose }: ChildFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<ChildFormValues>(() => defaultChildFormValues(editing, todayFn()));

  function setField<K extends keyof ChildFormValues>(key: K, value: ChildFormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: copil' : 'Adaugă: copil'}
      width={620}
      onClose={onClose}
      footer={
        <button type="button" className={styles.btnPrimary} onClick={() => onSubmit(values)}>
          Salvează
        </button>
      }
    >
      <div className={styles.form}>
        <fieldset className={styles.section}>
          <legend>Date copil</legend>
          <label className={styles.field}>
            Nume copil
            <input required value={values.name} onChange={event => setField('name', event.target.value)} />
          </label>
          <label className={styles.field}>
            Data nașterii
            <input type="date" value={values.birthDate} onChange={event => setField('birthDate', event.target.value)} />
            <small className={styles.hint}>Vârstă: {formatAge(values.birthDate)}</small>
          </label>
          <label className={styles.field}>
            Statut
            <select value={values.status} onChange={event => setField('status', event.target.value)}>
              {CHILD_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Grupă
            <select value={values.groupId} onChange={event => setField('groupId', event.target.value)}>
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
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Părinți</legend>
          <label className={styles.field}>
            Părinte 1
            <input required value={values.parent} onChange={event => setField('parent', event.target.value)} />
          </label>
          <label className={styles.field}>
            Telefon părinte 1 (opțional)
            <input type="tel" value={values.phone} onChange={event => setField('phone', event.target.value)} />
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
          <legend>Date medicale</legend>
          <label className={styles.field}>
            Date medicale
            <textarea
              rows={3}
              value={values.healthNotes}
              onChange={event => setField('healthNotes', event.target.value)}
            />
          </label>
          <p className={styles.notice}>Date sensibile: nu apar în export și în istoric.</p>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Contract și taxe</legend>
          <label className={styles.field}>
            Data contractului
            <input
              type="date"
              value={values.contractDate}
              onChange={event => setField('contractDate', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Început frecventare
            <input
              type="date"
              value={values.attendanceDate}
              onChange={event => setField('attendanceDate', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Retragere
            <input
              type="date"
              value={values.withdrawalDate}
              onChange={event => setField('withdrawalDate', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Statut aplicabil din luna
            <input
              type="month"
              required
              value={values.statusFrom}
              onChange={event => setField('statusFrom', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Taxa lunară (gol = necunoscută)
            <input
              type="number"
              min={0}
              step="0.01"
              value={values.fee}
              onChange={event => setField('fee', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Taxa aplicabilă din luna
            <input type="month" value={values.feeFrom} onChange={event => setField('feeFrom', event.target.value)} />
          </label>
          <label className={styles.field}>
            Ziua scadenței
            <input
              type="number"
              required
              min={1}
              max={31}
              value={values.dueDay}
              onChange={event => setField('dueDay', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Istoric (avansat)</legend>
          <label className={styles.field}>
            Istoric taxe — câte un rând: 2026-09 = 2000
            <textarea
              rows={3}
              value={values.feeHistoryText}
              onChange={event => setField('feeHistoryText', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Istoric statut — câte un rând: 2026-09 = Activ
            <textarea
              rows={3}
              value={values.statusHistoryText}
              onChange={event => setField('statusHistoryText', event.target.value)}
            />
          </label>
          <p className={styles.notice}>
            Taxele se aplică integral lunii începute. O taxă sau un statut schimbat adaugă o intrare din luna aleasă.
            Poți corecta explicit rândurile din istoric. Completează data începerii pentru calculul obligațiilor.
          </p>
        </fieldset>

        <label className={styles.field}>
          Observații
          <textarea rows={3} value={values.notes} onChange={event => setField('notes', event.target.value)} />
        </label>
      </div>
    </Drawer>
  );
}
