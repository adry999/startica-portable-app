import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

const PARENT_RELATIONS = ['Mamă', 'Tată', 'Bunică', 'Bunic', 'Tutore', 'Altul'];

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

  // Copil nou: „Începe la” calculează automat luna de la care se aplică taxa/statutul, plus
  // data contractului (câmp ascuns în „Copil nou”, decizia 29.09) — la editare, cele trei rămân
  // editabile separat, în secțiunea 5, ca să nu rescrie un istoric existent.
  function setAttendanceDate(value: string) {
    setValues(previous => {
      const next = { ...previous, attendanceDate: value };
      if (!editing && value) {
        const month = value.slice(0, 7);
        next.feeFrom = month;
        next.statusFrom = month;
        next.contractDate = value;
      }
      return next;
    });
  }

  function selectPreset(priceEur: number) {
    setValues(previous => ({ ...previous, fee: String(priceEur), currency: 'EUR' }));
  }

  function setPickupField(index: number, field: 'name' | 'relation' | 'phone' | 'note', value: string) {
    setValues(previous => ({
      ...previous,
      pickupPersons: previous.pickupPersons.map((person, i) => (i === index ? { ...person, [field]: value } : person)),
    }));
  }

  function addPickupPerson() {
    setValues(previous => ({
      ...previous,
      pickupPersons: [
        ...previous.pickupPersons,
        { id: crypto.randomUUID(), name: '', relation: '', phone: '', note: '' },
      ],
    }));
  }

  function removePickupPerson(index: number) {
    setValues(previous => ({ ...previous, pickupPersons: previous.pickupPersons.filter((_, i) => i !== index) }));
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
      title={editing ? 'Editează copilul' : 'Copil nou'}
      width={620}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <p className={styles.footerNote}>Poți completa restul mai târziu din fișă.</p>
          <div className={styles.footerActions}>
            <Button type="button" variant="outline" onClick={onClose}>
              Anulează
            </Button>
            <Button type="submit" form="child-form-drawer" disabled={submitting}>
              Salvează copilul
            </Button>
          </div>
        </div>
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
          {values.birthDate && (
            <small className={styles.hint}>
              {formatAge(values.birthDate)} · se potrivește în grupele:{' '}
              {compatibleGroups.length > 0 ? (
                <b>{compatibleGroups.map(group => group.name).join(', ')}</b>
              ) : (
                <>
                  {/* '/grupe' e ruta VIEW_PATHS.groups din app/shell/routes.ts — un feature nu are
                      voie să importe din app/ (tests/architecture/import-boundaries). */}
                  <b>niciuna</b> — <Link to="/grupe">vezi grupele</Link>
                </>
              )}
            </small>
          )}
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>2 · Părinți</legend>
          <div className={styles.parentRow}>
            <label className={styles.field}>
              Nume
              <input required value={values.parent} onChange={event => setField('parent', event.target.value)} />
            </label>
            <label className={styles.field}>
              Telefon
              <input type="tel" value={values.phone} onChange={event => setField('phone', event.target.value)} />
            </label>
            <label className={styles.field}>
              Relație
              <select value={values.parentRelation} onChange={event => setField('parentRelation', event.target.value)}>
                <option value="">—</option>
                {PARENT_RELATIONS.map(relation => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {showParent2 ? (
            <div className={styles.parentRow}>
              <label className={styles.field}>
                Nume
                <input value={values.parent2} onChange={event => setField('parent2', event.target.value)} />
              </label>
              <label className={styles.field}>
                Telefon
                <input type="tel" value={values.phone2} onChange={event => setField('phone2', event.target.value)} />
              </label>
              <label className={styles.field}>
                Relație
                <select
                  value={values.parent2Relation}
                  onChange={event => setField('parent2Relation', event.target.value)}
                >
                  <option value="">—</option>
                  {PARENT_RELATIONS.map(relation => (
                    <option key={relation} value={relation}>
                      {relation}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <button type="button" className={styles.addParentLink} onClick={() => setShowParent2(true)}>
              + Adaugă încă un părinte
            </button>
          )}
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>3 · Contract și taxă</legend>
          <div className={styles.grid3}>
            <label className={styles.field}>
              Nr. contract
              <input value={values.contractNumber} onChange={event => setField('contractNumber', event.target.value)} />
            </label>
            <label className={styles.field}>
              Începe la
              <input
                type="date"
                value={values.attendanceDate}
                onChange={event => setAttendanceDate(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Scadență
              <div className={styles.dueDayField}>
                <span>ziua</span>
                <input
                  type="number"
                  required
                  min={1}
                  max={31}
                  value={values.dueDay}
                  onChange={event => setField('dueDay', event.target.value)}
                />
              </div>
            </label>
          </div>
          {presets.length > 0 && (
            <div className={styles.cardGrid}>
              {presets.map(preset => {
                const selected = values.currency === 'EUR' && values.fee === String(preset.priceEur);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={selected ? `${styles.presetCard} ${styles.selected}` : styles.presetCard}
                    onClick={() => selectPreset(preset.priceEur)}
                  >
                    <span className={styles.presetCardName}>{preset.name}</span>
                    <span className={styles.presetCardPrice}>{preset.priceEur} €</span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>
            4 · Grupă <span className={styles.optional}>(opțional)</span>
          </legend>
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
                  title={free != null ? `${free} din ${group.capacity} locuri libere` : 'Fără limită de capacitate'}
                  className={
                    selected ? `${styles.groupChip} ${styles.selected}` : `${styles.groupChip} ${styles[tone]}`
                  }
                  onClick={() => setField('groupId', group.id)}
                >
                  {group.name}
                  {free != null ? ` · ${free} locuri` : ''}
                </button>
              );
            })}
          </div>
        </fieldset>

        {editing && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>5 · Alte date</summary>
            <div className={styles.detailsBody}>
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
              <div className={styles.grid2}>
                <label className={styles.field}>
                  Data contractului
                  <input
                    type="date"
                    value={values.contractDate}
                    onChange={event => setField('contractDate', event.target.value)}
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
              <div className={styles.grid3}>
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
                  <input
                    type="month"
                    value={values.feeFrom}
                    onChange={event => setField('feeFrom', event.target.value)}
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
                Date medicale / alergii
                <textarea
                  rows={3}
                  value={values.healthNotes}
                  onChange={event => setField('healthNotes', event.target.value)}
                />
              </label>
              <p className={styles.notice}>Date sensibile: nu apar în export și în istoric.</p>
              <div className={styles.field}>
                Persoane autorizate să ridice copilul
                <div className={styles.pickupList}>
                  {values.pickupPersons.map((person, index) => (
                    <div key={person.id} className={styles.pickupRow}>
                      <input
                        placeholder="Nume"
                        aria-label="Nume persoană autorizată"
                        value={person.name}
                        onChange={event => setPickupField(index, 'name', event.target.value)}
                      />
                      <input
                        placeholder="Relație"
                        aria-label="Relație persoană autorizată"
                        value={person.relation}
                        onChange={event => setPickupField(index, 'relation', event.target.value)}
                      />
                      <input
                        type="tel"
                        placeholder="Telefon"
                        aria-label="Telefon persoană autorizată"
                        value={person.phone}
                        onChange={event => setPickupField(index, 'phone', event.target.value)}
                      />
                      <input
                        placeholder="Notă"
                        aria-label="Notă persoană autorizată"
                        value={person.note}
                        onChange={event => setPickupField(index, 'note', event.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.removeRow}
                        aria-label="Șterge persoana autorizată"
                        onClick={() => removePickupPerson(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.addParentLink} onClick={addPickupPerson}>
                  + Adaugă
                </button>
              </div>
            </div>
          </details>
        )}

        {editing && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>6 · Istoric (avansat)</summary>
            <div className={styles.detailsBody}>
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
                Taxele se aplică integral lunii începute. O taxă sau un statut schimbat adaugă o intrare din luna
                aleasă. Poți corecta explicit rândurile din istoric. Completează data începerii pentru calculul
                obligațiilor.
              </p>
            </div>
          </details>
        )}
      </form>
    </Drawer>
  );
}
