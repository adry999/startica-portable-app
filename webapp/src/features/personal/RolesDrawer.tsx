import { useEffect, useState } from 'react';
import { Button, Checkbox, Drawer, Field, NumberInput, Select, TextInput, useToast } from '@shared/ui';
import { usePersonal } from '@shared/personal/usePersonal';
import { useDirtyForm } from '@shared/state/dirty-forms';
import type { Department, PersonalSettings, Role } from '@shared/personal/personal.types';
import styles from './RolesDrawer.module.css';

export interface RolesDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Funcții (23e) — departamente și funcții editabile; o funcție cu angajați nu se poate șterge.
 * A3f (verificarea 5, ALINIERE-DESIGN.md): `annualLeaveDays`/`deductOnlyUnexcused` aveau deja
 * rută + validare pe server (`/api/personal/settings`) și `usePersonal().saveSettings`, dar
 * niciun loc în UI care să le editeze — adăugate aici, cel mai apropiat ecran de „setări Personal”. */
export function RolesDrawer({ open, onClose }: RolesDrawerProps) {
  const personal = usePersonal();
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>(personal.departments);
  const [roles, setRoles] = useState<Role[]>(personal.roles);
  const [settings, setSettings] = useState<PersonalSettings>(personal.settings);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDepartmentId, setNewRoleDepartmentId] = useState(personal.departments[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  // Resincronizare cu ultima stare confirmată de server la fiecare deschidere.
  useEffect(() => {
    if (!open) return;
    setDepartments(personal.departments);
    setRoles(personal.roles);
    setSettings(personal.settings);
    setNewRoleDepartmentId(current => current || personal.departments[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function roleHasStaff(roleId: string): boolean {
    return personal.staff.some(person => person.roleId === roleId && !person.archivedAt);
  }

  function addDepartment() {
    const name = newDepartmentName.trim();
    if (!name) return;
    setDepartments(previous => [...previous, { id: `DEP-${crypto.randomUUID()}`, name, order: previous.length }]);
    setNewDepartmentName('');
  }

  function addRole() {
    const name = newRoleName.trim();
    if (!name || !newRoleDepartmentId) return;
    setRoles(previous => [
      ...previous,
      { id: `ROL-${crypto.randomUUID()}`, name, departmentId: newRoleDepartmentId, order: previous.length },
    ]);
    setNewRoleName('');
  }

  function renameDepartment(id: string, name: string) {
    setDepartments(previous =>
      previous.map(department => (department.id === id ? { ...department, name } : department)),
    );
  }

  function renameRole(id: string, name: string) {
    setRoles(previous => previous.map(role => (role.id === id ? { ...role, name } : role)));
  }

  function removeDepartment(id: string) {
    if (roles.some(role => role.departmentId === id)) {
      toast.show({ message: 'Departamentul are funcții — șterge-le mai întâi.' });
      return;
    }
    setDepartments(previous => previous.filter(department => department.id !== id));
  }

  function removeRole(id: string) {
    if (roleHasStaff(id)) {
      toast.show({ message: 'Funcția are angajați — nu poate fi ștearsă, doar redenumită.' });
      return;
    }
    setRoles(previous => previous.filter(role => role.id !== id));
  }

  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(personal.settings);
  const settingsInvalid =
    !Number.isInteger(settings.annualLeaveDays) || settings.annualLeaveDays < 0 || settings.annualLeaveDays > 365;

  async function save(): Promise<boolean> {
    if (settingsInvalid) {
      toast.show({ message: 'Zilele de concediu anual trebuie să fie un număr întreg între 0 și 365.' });
      return false;
    }
    setSaving(true);
    try {
      await personal.saveRoles(departments, roles);
      if (settingsDirty) await personal.saveSettings(settings);
      toast.show({ message: 'Funcțiile au fost salvate.' });
      onClose();
      return true;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  // 13b: nesalvat înseamnă că departamentele/funcțiile/setările de aici diferă de ultima stare confirmată.
  const dirty =
    open &&
    (JSON.stringify(departments) !== JSON.stringify(personal.departments) ||
      JSON.stringify(roles) !== JSON.stringify(personal.roles) ||
      settingsDirty);
  useDirtyForm(dirty ? { label: 'o modificare la funcții', save } : null);

  return (
    <Drawer
      open={open}
      title="Departamente și funcții"
      width={520}
      onClose={onClose}
      footer={
        <Button onClick={() => void save()} disabled={saving || settingsInvalid}>
          Salvează
        </Button>
      }
    >
      <div className={styles.root}>
        <div className={styles.settingsGroup}>
          <p className={styles.settingsTitle}>Setări concedii și salarii</p>
          <Field label="Zile de concediu anual" htmlFor="roles-annual-leave-days">
            <NumberInput
              id="roles-annual-leave-days"
              min={0}
              max={365}
              value={String(settings.annualLeaveDays)}
              onChange={value => setSettings(previous => ({ ...previous, annualLeaveDays: Number(value) }))}
            />
          </Field>
          <label className={styles.settingsCheckbox}>
            <Checkbox
              checked={settings.deductOnlyUnexcused}
              onChange={checked => setSettings(previous => ({ ...previous, deductOnlyUnexcused: checked }))}
              ariaLabel="Scade din salariu doar absențele nemotivate (A)"
            />
            <span>Scade din salariu doar absențele nemotivate (A)</span>
          </label>
          <p className={styles.settingsHint}>
            Debifat: se scad și învoirile (I) și zilele fără plată (FP), nu doar absențele nemotivate.
          </p>
        </div>

        {departments
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(department => (
            <div key={department.id} className={styles.departmentGroup}>
              <div className={styles.departmentRow}>
                <TextInput
                  ariaLabel="Nume departament"
                  className={styles.rowField}
                  value={department.name}
                  onChange={value => renameDepartment(department.id, value)}
                />
                <button type="button" className={styles.removeButton} onClick={() => removeDepartment(department.id)}>
                  Șterge
                </button>
              </div>
              <ul className={styles.roleList}>
                {roles
                  .filter(role => role.departmentId === department.id)
                  .map(role => (
                    <li key={role.id} className={styles.roleRow}>
                      <TextInput
                        ariaLabel="Nume funcție"
                        className={styles.rowField}
                        value={role.name}
                        onChange={value => renameRole(role.id, value)}
                      />
                      <button
                        type="button"
                        className={styles.removeButton}
                        disabled={roleHasStaff(role.id)}
                        title={roleHasStaff(role.id) ? 'Funcția are angajați' : undefined}
                        onClick={() => removeRole(role.id)}
                      >
                        Șterge
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

        <div className={styles.addRow}>
          <TextInput
            ariaLabel="Departament nou"
            className={styles.rowField}
            placeholder="Departament nou"
            value={newDepartmentName}
            onChange={setNewDepartmentName}
          />
          <Button variant="outline" onClick={addDepartment}>
            + Adaugă
          </Button>
        </div>

        <div className={styles.addRow}>
          <Select
            ariaLabel="Departamentul funcției noi"
            className={styles.rowField}
            value={newRoleDepartmentId}
            onChange={setNewRoleDepartmentId}
            options={departments.map(department => ({ value: department.id, label: department.name }))}
          />
          <TextInput
            ariaLabel="Funcție nouă"
            className={styles.rowField}
            placeholder="Funcție nouă"
            value={newRoleName}
            onChange={setNewRoleName}
          />
          <Button variant="outline" onClick={addRole}>
            + Adaugă
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
