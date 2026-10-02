import { useState } from 'react';
import {
  Button,
  DateInput,
  Drawer,
  Field,
  PhoneInput,
  SearchSelect,
  Select,
  SegmentedControl,
  TextInput,
  useToast,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Staff } from '@shared/personal/personal.types';
import styles from './StaffFormDrawer.module.css';
import { toUserError } from '@shared/api/to-user-error';

export interface StaffFormDrawerProps {
  target: Staff | 'new' | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  roleId: string;
  phone: string;
  birth: string;
  idnp: string;
  address: string;
  since: string;
}

function defaultValues(target: Staff | null, todayStr: string, firstRoleId: string): FormValues {
  return {
    name: target?.name ?? '',
    roleId: target?.roleId ?? firstRoleId,
    phone: target?.phone ?? '',
    birth: target?.birth ?? '',
    idnp: target?.idnp ?? '',
    address: target?.address ?? '',
    since: target?.since ?? todayStr,
  };
}

/**
 * Formular angajat (23j editare / creare) — funcția și datele personale. F29 (DECIZII 02.10,
 * „Scrii doar în filiala deschisă"): un angajat nou intră direct în filiala deschisă, fără
 * alegere; `branchIds` nu se mai editează din acest formular după creare — un angajat care
 * lucrează deja în altă filială se adaugă la cea deschisă din comutatorul „Angajat existent”.
 */
export function StaffFormDrawer({ target, onClose }: StaffFormDrawerProps) {
  const personal = usePersonal();
  const session = useAppSession();
  const toast = useToast();
  const editing = target !== null && target !== 'new' ? target : null;
  const rolesSorted = [...personal.roles].sort((a, b) => a.order - b.order);
  const [values, setValues] = useState<FormValues>(() => defaultValues(editing, today(), rolesSorted[0]?.id ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [entryMode, setEntryMode] = useState<'new' | 'existing'>('new');
  const [existingStaffId, setExistingStaffId] = useState('');

  const openBranchId = session.state.branch?.id ?? '';
  const openBranchName = session.state.branch?.name ?? '';

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  const existingCandidates = personal.staff.filter(
    staff => !staff.archivedAt && !staff.branchIds.includes(openBranchId),
  );

  async function handleAddExisting() {
    const found = personal.staff.find(staff => staff.id === existingStaffId);
    if (!found || submitting) return;
    setSubmitting(true);
    try {
      await personal.saveStaff('update', { ...found, branchIds: [...found.branchIds, openBranchId] });
      toast.show({ message: `${found.name} a fost adăugat la ${openBranchName}.` });
      onClose();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const record: Staff = {
        id: editing?.id ?? `STF-${crypto.randomUUID()}`,
        name: values.name.trim(),
        roleId: values.roleId,
        branchIds: editing?.branchIds ?? [openBranchId],
        phone: values.phone.trim(),
        birth: values.birth || undefined,
        idnp: values.idnp || undefined,
        address: values.address || undefined,
        since: values.since,
        archivedAt: editing?.archivedAt ?? null,
        notes: editing?.notes ?? [],
      };
      await personal.saveStaff(editing ? 'update' : 'create', record);
      toast.show({ message: editing ? 'Angajat actualizat.' : 'Angajat adăugat.' });
      onClose();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  const showExistingPicker = !editing && entryMode === 'existing';

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează angajatul' : 'Angajat nou'}
      size="form"
      onClose={onClose}
      footer={
        showExistingPicker ? (
          <Button onClick={() => void handleAddExisting()} loading={submitting} disabled={!existingStaffId}>
            Adaugă la {openBranchName}
          </Button>
        ) : (
          <Button type="submit" form="staff-form-drawer" loading={submitting}>
            Salvează angajatul
          </Button>
        )
      }
    >
      {!editing && (
        <div className={styles.field}>
          <SegmentedControl
            ariaLabel="Mod adăugare"
            value={entryMode}
            onChange={setEntryMode}
            options={[
              { value: 'new', label: 'Angajat nou' },
              { value: 'existing', label: 'Angajat existent' },
            ]}
          />
        </div>
      )}

      {showExistingPicker ? (
        <div className={styles.field}>
          <Field label="Caută angajatul" htmlFor="staff-existing-search">
            <SearchSelect
              ariaLabel="Angajat existent"
              options={existingCandidates.map(staff => ({ value: staff.id, label: staff.name }))}
              value={existingStaffId}
              onChange={setExistingStaffId}
              placeholder="Caută după nume…"
              emptyLabel="Niciun angajat din altă filială de adăugat"
            />
          </Field>
          <p className={styles.notice}>Angajatul rămâne și în filiala lui curentă — se adaugă aici în plus.</p>
        </div>
      ) : (
        <form
          id="staff-form-drawer"
          className={styles.form}
          autoComplete="off"
          onSubmit={event => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Field label="Nume angajat" htmlFor="staff-name">
            <TextInput id="staff-name" required value={values.name} onChange={value => setField('name', value)} />
          </Field>
          <Field label="Funcția" htmlFor="staff-role">
            <Select
              id="staff-role"
              required
              value={values.roleId}
              onChange={value => setField('roleId', value)}
              options={rolesSorted.map(role => ({ value: role.id, label: role.name }))}
            />
          </Field>
          {!editing && (
            <p className={styles.notice}>Se adaugă în Filiala {openBranchName} (filiala deschisă).</p>
          )}
          <Field label="Telefon" htmlFor="staff-phone">
            <PhoneInput id="staff-phone" value={values.phone} onChange={value => setField('phone', value)} />
          </Field>
          <Field label="Data nașterii" htmlFor="staff-birth">
            <DateInput id="staff-birth" value={values.birth} onChange={value => setField('birth', value)} />
          </Field>
          <Field label="IDNP" htmlFor="staff-idnp">
            <TextInput
              id="staff-idnp"
              inputMode="numeric"
              value={values.idnp}
              onChange={value => setField('idnp', value.replace(/\D/g, '').slice(0, 13))}
            />
          </Field>
          <Field label="Adresă" htmlFor="staff-address">
            <TextInput id="staff-address" value={values.address} onChange={value => setField('address', value)} />
          </Field>
          <Field label="Data angajării" htmlFor="staff-since">
            <DateInput id="staff-since" required value={values.since} onChange={value => setField('since', value)} />
          </Field>
        </form>
      )}
    </Drawer>
  );
}
