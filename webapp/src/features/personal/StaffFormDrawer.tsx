import { useState } from 'react';
import { Button, DateInput, Drawer, Field, PhoneInput, Select, TextInput, useToast } from '@shared/ui';
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
        <div className={styles.field}>
          Filiala
          {/* Comutare multiplă independentă (una sau ambele filiale, 24-personal.md §Date) — nici
              ChipSelect (radiogroup, alegere unică), nici MultiSelect (popover cu căutare, pentru
              liste lungi) nu se potrivesc unei perechi fixe de pastile mereu vizibile (R1). */}
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
    </Drawer>
  );
}
