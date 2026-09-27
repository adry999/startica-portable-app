import { useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Staff } from '@shared/personal/personal.types';
import styles from './StaffFormDrawer.module.css';

export interface StaffFormDrawerProps {
  target: Staff | 'new' | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  roleId: string;
  branchIds: string[];
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
    branchIds: target?.branchIds ?? [],
    phone: target?.phone ?? '',
    birth: target?.birth ?? '',
    idnp: target?.idnp ?? '',
    address: target?.address ?? '',
    since: target?.since ?? todayStr,
  };
}

/** Formular angajat (23j editare / creare) — funcția, filialele (cel puțin una) și datele personale. */
export function StaffFormDrawer({ target, onClose }: StaffFormDrawerProps) {
  const personal = usePersonal();
  const session = useAppSession();
  const toast = useToast();
  const editing = target !== null && target !== 'new' ? target : null;
  const rolesSorted = [...personal.roles].sort((a, b) => a.order - b.order);
  const [values, setValues] = useState<FormValues>(() => defaultValues(editing, today(), rolesSorted[0]?.id ?? ''));
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  function toggleBranch(branchId: string) {
    setValues(previous => ({
      ...previous,
      branchIds: previous.branchIds.includes(branchId)
        ? previous.branchIds.filter(id => id !== branchId)
        : [...previous.branchIds, branchId],
    }));
  }

  async function handleSubmit() {
    if (submitting) return;
    if (values.branchIds.length === 0) {
      toast.show({ message: 'Alege cel puțin o filială.' });
      return;
    }
    setSubmitting(true);
    try {
      const record: Staff = {
        id: editing?.id ?? `STF-${crypto.randomUUID()}`,
        name: values.name.trim(),
        roleId: values.roleId,
        branchIds: values.branchIds,
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
      toast.show({ message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: angajat' : 'Adaugă: angajat'}
      width={560}
      onClose={onClose}
      footer={
        <Button type="submit" form="staff-form-drawer" disabled={submitting}>
          Salvează
        </Button>
      }
    >
      <form
        id="staff-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          Nume angajat
          <input required value={values.name} onChange={event => setField('name', event.target.value)} />
        </label>
        <label className={styles.field}>
          Funcția
          <select required value={values.roleId} onChange={event => setField('roleId', event.target.value)}>
            {rolesSorted.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          Filiala
          <div className={styles.branchToggles} role="group" aria-label="Filiale">
            {session.state.branches.map(branch => (
              <button
                key={branch.id}
                type="button"
                className={values.branchIds.includes(branch.id) ? styles.branchPillActive : styles.branchPill}
                onClick={() => toggleBranch(branch.id)}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          Telefon
          <input type="tel" value={values.phone} onChange={event => setField('phone', event.target.value)} />
        </label>
        <label className={styles.field}>
          Data nașterii
          <input type="date" value={values.birth} onChange={event => setField('birth', event.target.value)} />
        </label>
        <label className={styles.field}>
          IDNP
          <input value={values.idnp} onChange={event => setField('idnp', event.target.value)} />
        </label>
        <label className={styles.field}>
          Adresă
          <input value={values.address} onChange={event => setField('address', event.target.value)} />
        </label>
        <label className={styles.field}>
          Data angajării
          <input required type="date" value={values.since} onChange={event => setField('since', event.target.value)} />
        </label>
      </form>
    </Drawer>
  );
}
