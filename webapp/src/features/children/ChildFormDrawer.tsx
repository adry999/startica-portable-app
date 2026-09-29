import { useMemo, useRef, useState } from 'react';
import { Button, Drawer, groupTone } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import { formatAge, ageInYears } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { usePlanPresets } from '@shared/api/usePlanPresets';
import { sortByGroupOrder } from '@shared/format/group-order';
import { CHILD_STATUSES, defaultChildFormValues, type ChildFeeCurrency, type ChildFormValues } from './child-form';
import type { ChildRow } from './useChildren';
import type { Child, Group } from '@contracts/record-types.mjs';
import styles from './ChildFormDrawer.module.css';

export interface ChildFormDrawerProps {
  target: Child | 'new' | null;
  groups: Group[];
  /** Pentru „locuri libere” pe chip-urile de grupă (15a) — rândurile nearhivate curente. */
  allChildren?: ChildRow[];
  onSubmit: (values: ChildFormValues) => Promise<void>;
  onClose: () => void;
}

export function ChildFormDrawer({ target, groups, allChildren = [], onSubmit, onClose }: ChildFormDrawerProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [values, setValues] = useState<ChildFormValues>(() => defaultChildFormValues(editing, todayFn()));
  // Valorile de la montare — comparate cu cele curente pentru garda de formular nesalvat (13b).
  const initialValuesRef = useRef(values);
  const [submitting, setSubmitting] = useState(false);
  // 15a: al doilea părinte pornește ascuns („+ Adaugă încă un părinte”), în afară de fișele
  // care au deja completat parent2 — altfel editarea unei fișe vechi i-ar ascunde datele.
  const [showParent2, setShowParent2] = useState(() => Boolean(editing?.parent2));
  const { presets } = usePlanPresets();

  const orderedGroups = useMemo(() => sortByGroupOrder(groups), [groups]);

  const occupiedByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allChildren) {
      if (row.archived || !row.groupId || row.id === editing?.id) continue;
      counts.set(row.groupId, (counts.get(row.groupId) ?? 0) + 1);
    }
    return counts;
  }, [allChildren, editing]);

  const childAgeYears = values.birthDate ? ageInYears(values.birthDate) : null;
  const compatibleGroups = useMemo(() => {
    if (childAgeYears === null) return [];
    return orderedGroups.filter(
      group =>
        (group.ageMinYears == null || childAgeYears >= group.ageMinYears) &&
        (group.ageMaxYears == null || childAgeYears <= group.ageMaxYears) &&
        (group.ageMinYears != null || group.ageMaxYears != null),
    );
  }, [orderedGroups, childAgeYears]);

  function setField<K extends keyof ChildFormValues>(key: K, value: ChildFormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  // `name` rămâne sursa unică pentru căutare/sortare/inițiale/CSV/Excel/chitanțe (aceeași
  // regulă ca în normalizeRecord/buildChildRecord): se recalculează aici, la fiecare tastă, doar
  // când ambele câmpuri sunt completate, ca orice previzualizare din formular să vadă name-ul
  // corect înainte de submit, nu doar înregistrarea trimisă la server.
  function setNamePart(part: 'firstName' | 'lastName', value: string) {
    setValues(previous => {
      const next = { ...previous, [part]: value };
      const firstName = next.firstName.trim();
      const lastName = next.lastName.trim();
      if (firstName && lastName) next.name = `${lastName} ${firstName}`.trim();
      return next;
    });
  }

  async function handleSubmit(): Promise<boolean> {
    if (submitting) return false;
    setSubmitting(true);
    try {
      await onSubmit(values);
      return true;
    } catch {
      // C1: save() nu are voie să arunce mai departe — onSubmit re-aruncă după ce a arătat
      // toast-ul de eroare (ChildrenPage.submitChildForm); aici doar convertim în „nesalvat”.
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const dirty = target !== null && JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  useDirtyForm(dirty ? { label: 'o fișă de copil', save: handleSubmit } : null);

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: copil' : 'Adaugă: copil'}
      width={620}
      onClose={onClose}
      footer={
        <Button type="submit" form="child-form-drawer" disabled={submitting}>
          Salvează copilul
        </Button>
      }
    >
      <form
        id="child-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>1 · Copil</legend>
          <div className={styles.grid3}>
            <label className={styles.field}>
              Nume
              <input
                required={!editing}
                value={values.lastName}
                onChange={event => setNamePart('lastName', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Prenume
              <input
                required={!editing}
                value={values.firstName}
                onChange={event => setNamePart('firstName', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Data nașterii
              <input
                type="date"
                value={values.birthDate}
                onChange={event => setField('birthDate', event.target.value)}
              />
            </label>
          </div>
          <small className={styles.hint}>Vârstă: {formatAge(values.birthDate)}</small>
          {compatibleGroups.length > 0 && (
            <div className={styles.field}>
              Grupe compatibile cu vârsta
              <div className={styles.compatGroups}>
                {compatibleGroups.map(group => (
                  <span key={group.id} className={styles.compatBadge}>
                    {group.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* IDNP/Adresă/Statut nu apar în Formulare.dc.html#15a — date personale reale,
              adăugate peste spec (vezi COADA-DE-LUCRU.md, „Date personale”). */}
          <div className={styles.grid2}>
            <label className={styles.field}>
              IDNP
              <input
                inputMode="numeric"
                maxLength={13}
                value={values.idnp}
                onChange={event => setField('idnp', event.target.value.replace(/\D/g, '').slice(0, 13))}
              />
            </label>
            <label className={styles.field}>
              Adresă
              <input value={values.address} onChange={event => setField('address', event.target.value)} />
            </label>
          </div>
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
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>2 · Părinți</legend>
          <div className={styles.parentRow}>
            <label className={styles.field}>
              Nume
              <input required value={values.parent} onChange={event => setField('parent', event.target.value)} />
            </label>
            <label className={styles.field}>
              Telefon (opțional)
              <input type="tel" value={values.phone} onChange={event => setField('phone', event.target.value)} />
            </label>
          </div>
          {showParent2 ? (
            <div className={styles.parentRow}>
              <label className={styles.field}>
                Nume
                <input value={values.parent2} onChange={event => setField('parent2', event.target.value)} />
              </label>
              <label className={styles.field}>
                Telefon (opțional)
                <input type="tel" value={values.phone2} onChange={event => setField('phone2', event.target.value)} />
              </label>
            </div>
          ) : (
            <button type="button" className={styles.addParentLink} onClick={() => setShowParent2(true)}>
              + Adaugă încă un părinte
            </button>
          )}
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
          <legend className={styles.sectionTitle}>3 · Contract și taxă</legend>
          <div className={styles.grid3}>
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
          </div>
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
            Monedă
            <select
              value={values.currency}
              onChange={event => setField('currency', event.target.value as ChildFeeCurrency)}
            >
              <option value="MDL">MDL</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          {values.currency === 'EUR' && presets.length > 0 && (
            <div className={styles.field}>
              Program (scurtătură pentru sumă)
              <div className={styles.cardGrid}>
                {presets.map(preset => {
                  const selected = values.fee === String(preset.priceEur);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={selected ? `${styles.presetCard} ${styles.selected}` : styles.presetCard}
                      onClick={() => setField('fee', String(preset.priceEur))}
                    >
                      <span className={styles.presetCardName}>{preset.name}</span>
                      <span className={styles.presetCardPrice}>{preset.priceEur} €</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={styles.grid3}>
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
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>4 · Grupă (opțional)</legend>
          <div className={styles.groupChips}>
            <button
              type="button"
              className={values.groupId === '' ? `${styles.groupChip} ${styles.selected}` : styles.groupChip}
              onClick={() => setField('groupId', '')}
            >
              Fără grupă
            </button>
            {orderedGroups.map(group => {
              const occupied = occupiedByGroup.get(group.id) ?? 0;
              const free = group.capacity != null ? group.capacity - occupied : null;
              const selected = values.groupId === group.id;
              const tone = groupTone(group.id, orderedGroups);
              return (
                <button
                  key={group.id}
                  type="button"
                  className={
                    selected ? `${styles.groupChip} ${styles.selected}` : `${styles.groupChip} ${styles[tone]}`
                  }
                  onClick={() => setField('groupId', group.id)}
                >
                  {group.name}
                  <span className={styles.groupChipSpots}>
                    {free != null ? `${free} locuri libere` : 'fără limită'}
                  </span>
                </button>
              );
            })}
          </div>
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
      </form>
    </Drawer>
  );
}
