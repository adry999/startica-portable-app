import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  DateInput,
  Drawer,
  Field,
  IconButton,
  NumberInput,
  PhoneInput,
  Select,
  TextArea,
  TextInput,
  groupTone,
} from '@shared/ui';
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
const PARENT_RELATION_OPTIONS = PARENT_RELATIONS.map(relation => ({ value: relation, label: relation }));
const CHILD_STATUS_OPTIONS = CHILD_STATUSES.map(status => ({ value: status, label: status }));
const CURRENCY_OPTIONS: { value: ChildFeeCurrency; label: string }[] = [
  { value: 'MDL', label: 'MDL' },
  { value: 'EUR', label: 'EUR' },
];

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
            <Field label="Nume" htmlFor="child-last-name">
              <TextInput
                id="child-last-name"
                required={!editing}
                value={values.lastName}
                onChange={value => setNamePart('lastName', value)}
              />
            </Field>
            <Field label="Prenume" htmlFor="child-first-name">
              <TextInput
                id="child-first-name"
                required={!editing}
                value={values.firstName}
                onChange={value => setNamePart('firstName', value)}
              />
            </Field>
            <Field label="Data nașterii" htmlFor="child-birth-date">
              <DateInput
                id="child-birth-date"
                value={values.birthDate}
                onChange={value => setField('birthDate', value)}
              />
            </Field>
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
            <Field label="Nume" htmlFor="parent1-name">
              <TextInput
                id="parent1-name"
                required
                value={values.parent}
                onChange={value => setField('parent', value)}
              />
            </Field>
            <Field label="Telefon" htmlFor="parent1-phone">
              <PhoneInput id="parent1-phone" value={values.phone} onChange={value => setField('phone', value)} />
            </Field>
            <Field label="Relație" htmlFor="parent1-relation">
              <Select
                id="parent1-relation"
                value={values.parentRelation}
                onChange={value => setField('parentRelation', value)}
                options={PARENT_RELATION_OPTIONS}
                placeholder="—"
              />
            </Field>
          </div>
          {showParent2 ? (
            <div className={styles.parentRow}>
              <Field label="Nume" htmlFor="parent2-name">
                <TextInput id="parent2-name" value={values.parent2} onChange={value => setField('parent2', value)} />
              </Field>
              <Field label="Telefon" htmlFor="parent2-phone">
                <PhoneInput id="parent2-phone" value={values.phone2} onChange={value => setField('phone2', value)} />
              </Field>
              <Field label="Relație" htmlFor="parent2-relation">
                <Select
                  id="parent2-relation"
                  value={values.parent2Relation}
                  onChange={value => setField('parent2Relation', value)}
                  options={PARENT_RELATION_OPTIONS}
                  placeholder="—"
                />
              </Field>
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
            <Field label="Nr. contract" htmlFor="child-contract-number">
              <TextInput
                id="child-contract-number"
                value={values.contractNumber}
                onChange={value => setField('contractNumber', value)}
              />
            </Field>
            <Field label="Începe la" htmlFor="child-attendance-date">
              <DateInput id="child-attendance-date" value={values.attendanceDate} onChange={setAttendanceDate} />
            </Field>
            <Field label="Scadență" htmlFor="child-due-day" hint="Ziua din lună (1–31)">
              <NumberInput
                id="child-due-day"
                required
                min={1}
                max={31}
                step={1}
                value={values.dueDay}
                onChange={value => setField('dueDay', value)}
              />
            </Field>
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
                <Field label="IDNP" htmlFor="child-idnp">
                  <TextInput
                    id="child-idnp"
                    inputMode="numeric"
                    value={values.idnp}
                    onChange={value => setField('idnp', value.replace(/\D/g, '').slice(0, 13))}
                  />
                </Field>
                <Field label="Adresă" htmlFor="child-address">
                  <TextInput id="child-address" value={values.address} onChange={value => setField('address', value)} />
                </Field>
              </div>
              <Field label="Statut" htmlFor="child-status">
                <Select
                  id="child-status"
                  value={values.status}
                  onChange={value => setField('status', value)}
                  options={CHILD_STATUS_OPTIONS}
                />
              </Field>
              <div className={styles.grid2}>
                <Field label="Data contractului" htmlFor="child-contract-date">
                  <DateInput
                    id="child-contract-date"
                    value={values.contractDate}
                    onChange={value => setField('contractDate', value)}
                  />
                </Field>
                <Field label="Retragere" htmlFor="child-withdrawal-date">
                  <DateInput
                    id="child-withdrawal-date"
                    value={values.withdrawalDate}
                    onChange={value => setField('withdrawalDate', value)}
                  />
                </Field>
              </div>
              <div className={styles.grid3}>
                <Field label="Monedă" htmlFor="child-currency">
                  <Select
                    id="child-currency"
                    value={values.currency}
                    onChange={value => setField('currency', value as ChildFeeCurrency)}
                    options={CURRENCY_OPTIONS}
                  />
                </Field>
                <Field label="Taxa lunară (gol = necunoscută)" htmlFor="child-fee">
                  <NumberInput
                    id="child-fee"
                    min={0}
                    step="0.01"
                    value={values.fee}
                    onChange={value => setField('fee', value)}
                  />
                </Field>
                {/* type="month" rămâne brut — nu există încă `MonthInput` în @shared/ui (COMPONENTE.md
                    §0/25b), la fel ca rândul de alocare din PaymentFormDrawer. */}
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
              <Field label="Date medicale / alergii" htmlFor="child-health-notes">
                <TextArea
                  id="child-health-notes"
                  rows={3}
                  value={values.healthNotes}
                  onChange={value => setField('healthNotes', value)}
                />
              </Field>
              <p className={styles.notice}>Date sensibile: nu apar în export și în istoric.</p>
              <div className={styles.field}>
                Persoane autorizate să ridice copilul
                <div className={styles.pickupList}>
                  {values.pickupPersons.map((person, index) => (
                    <div key={person.id} className={styles.pickupRow}>
                      <TextInput
                        placeholder="Nume"
                        ariaLabel="Nume persoană autorizată"
                        value={person.name}
                        onChange={value => setPickupField(index, 'name', value)}
                      />
                      <TextInput
                        placeholder="Relație"
                        ariaLabel="Relație persoană autorizată"
                        value={person.relation}
                        onChange={value => setPickupField(index, 'relation', value)}
                      />
                      <PhoneInput
                        placeholder="Telefon"
                        ariaLabel="Telefon persoană autorizată"
                        value={person.phone}
                        onChange={value => setPickupField(index, 'phone', value)}
                      />
                      <TextInput
                        placeholder="Notă"
                        ariaLabel="Notă persoană autorizată"
                        value={person.note}
                        onChange={value => setPickupField(index, 'note', value)}
                      />
                      <IconButton
                        className={styles.removeRow}
                        icon="close"
                        ariaLabel="Șterge persoana autorizată"
                        onClick={() => removePickupPerson(index)}
                      />
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
              <Field label="Istoric taxe — câte un rând: 2026-09 = 2000" htmlFor="child-fee-history">
                <TextArea
                  id="child-fee-history"
                  rows={3}
                  value={values.feeHistoryText}
                  onChange={value => setField('feeHistoryText', value)}
                />
              </Field>
              <Field label="Istoric statut — câte un rând: 2026-09 = Activ" htmlFor="child-status-history">
                <TextArea
                  id="child-status-history"
                  rows={3}
                  value={values.statusHistoryText}
                  onChange={value => setField('statusHistoryText', value)}
                />
              </Field>
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
