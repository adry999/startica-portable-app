import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  EditableList,
  Field,
  NumberInput,
  Select,
  TextInput,
  useToast,
  type BadgeTone,
} from '@shared/ui';
import { usePersonal } from '@shared/personal/usePersonal';
import { useUnsavedChangesGuard } from '@shared/state/useUnsavedChangesGuard';
import type { Department, PersonalSettings, Role } from '@shared/personal/personal.types';
import styles from './RolesDrawer.module.css';
import { toUserError } from '@shared/api/to-user-error';

export interface RolesDrawerProps {
  open: boolean;
  onClose: () => void;
}

// 38f: punctul colorat arată departamentul funcției (nu funcția însăși) — aceleași 8 tonuri
// ciclice ca grupele (group-tone.ts), după poziția departamentului în listă.
const ROLE_TONES: BadgeTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

function departmentTone(departmentId: string, departmentList: Department[]): BadgeTone {
  const sorted = departmentList.slice().sort((a, b) => a.order - b.order);
  const index = sorted.findIndex(department => department.id === departmentId);
  return ROLE_TONES[index === -1 ? 0 : index % ROLE_TONES.length];
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
  const [rolesMode, setRolesMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  // Resincronizare cu ultima stare confirmată de server la fiecare deschidere.
  useEffect(() => {
    if (!open) return;
    setDepartments(personal.departments);
    setRoles(personal.roles);
    setSettings(personal.settings);
    setRolesMode('view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function roleStaffCount(roleId: string): number {
    return personal.staff.filter(person => person.roleId === roleId && !person.archivedAt).length;
  }

  function departmentNameFor(departmentId: string): string {
    return departments.find(department => department.id === departmentId)?.name ?? '';
  }

  function addDepartment() {
    const name = newDepartmentName.trim();
    if (!name) return;
    setDepartments(previous => [...previous, { id: `DEP-${crypto.randomUUID()}`, name, order: previous.length }]);
    setNewDepartmentName('');
  }

  // 38f/COMPONENTE.md §3b: „+ Adaugă funcția” din view trece direct în edit, cu un rând nou gol
  // (același tipar ca „+ Adaugă plan” din ExchangeRateSettings, F13).
  function addRole() {
    setRoles(previous => [
      ...previous,
      {
        id: `ROL-${crypto.randomUUID()}`,
        name: '',
        departmentId: departments[0]?.id ?? '',
        order: previous.length,
      },
    ]);
    setRolesMode('edit');
  }

  function renameDepartment(id: string, name: string) {
    setDepartments(previous =>
      previous.map(department => (department.id === id ? { ...department, name } : department)),
    );
  }

  function renameRole(id: string, name: string) {
    setRoles(previous => previous.map(role => (role.id === id ? { ...role, name } : role)));
  }

  function setRoleDepartment(id: string, departmentId: string) {
    setRoles(previous => previous.map(role => (role.id === id ? { ...role, departmentId } : role)));
  }

  function removeDepartment(id: string) {
    if (roles.some(role => role.departmentId === id)) {
      toast.show({ message: 'Departamentul are funcții — șterge-le mai întâi.' });
      return;
    }
    setDepartments(previous => previous.filter(department => department.id !== id));
  }

  function removeRole(id: string) {
    if (roleStaffCount(id) > 0) {
      toast.show({ message: 'Funcția are angajați — nu poate fi ștearsă, doar redenumită.' });
      return;
    }
    setRoles(previous => previous.filter(role => role.id !== id));
  }

  function discardRoleChanges() {
    setRoles(personal.roles);
    setRolesMode('view');
  }

  // 13b: lista de funcții e „nesalvată” față de ultima stare confirmată de server — separat
  // de `dirty` (care include și departamentele/setările), pentru butonul „Salvează” propriu.
  const rolesDirty = JSON.stringify(roles) !== JSON.stringify(personal.roles);

  async function saveRolesSection(): Promise<boolean> {
    if (roles.some(role => !role.name.trim())) {
      toast.show({ message: 'Fiecare funcție trebuie să aibă un nume.' });
      return false;
    }
    setSavingRoles(true);
    try {
      await personal.saveRoles(departments, roles);
      toast.show({ message: 'Funcțiile au fost salvate.' });
      setRolesMode('view');
      return true;
    } catch (error) {
      toast.show({ message: toUserError(error) });
      return false;
    } finally {
      setSavingRoles(false);
    }
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
      toast.show({ message: toUserError(error) });
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
  // 40c: × / Esc / fundalul Drawer-ului trec prin `requestClose`, nu direct prin `onClose`.
  const unsavedGuard = useUnsavedChangesGuard({
    dirty,
    label: 'o modificare la funcții',
    formName: 'departamentele și funcțiile',
    save,
    onClose,
  });

  return (
    <>
      <Drawer
        open={open}
        title="Departamente și funcții"
        size="detail"
        onClose={unsavedGuard.requestClose}
        footer={
          <Button loading={saving} onClick={() => void save()} disabled={settingsInvalid}>
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
                  <Button variant="danger" onClick={() => removeDepartment(department.id)}>
                    Șterge
                  </Button>
                </div>
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

          <EditableList<Role>
            title="Funcții"
            items={roles.slice().sort((a, b) => a.order - b.order)}
            getId={role => role.id}
            mode={rolesMode}
            renderView={role => (
              <div className={styles.roleView}>
                <span
                  className={`${styles.roleDot} ${styles[departmentTone(role.departmentId, departments)]}`}
                  aria-hidden="true"
                />
                <div className={styles.roleInfo}>
                  <b className={styles.roleViewName}>{role.name}</b>
                  <span className={styles.roleViewDept}>{departmentNameFor(role.departmentId)}</span>
                </div>
                <span className={styles.roleViewCount}>
                  {roleStaffCount(role.id)} {roleStaffCount(role.id) === 1 ? 'angajat' : 'angajați'}
                </span>
              </div>
            )}
            renderEdit={role => (
              <div className={styles.roleEditRow}>
                <TextInput
                  ariaLabel="Nume funcție"
                  className={styles.rowField}
                  value={role.name}
                  onChange={value => renameRole(role.id, value)}
                />
                <Select
                  ariaLabel="Departamentul funcției"
                  className={styles.roleEditDepartment}
                  value={role.departmentId}
                  onChange={value => setRoleDepartment(role.id, value)}
                  options={departments.map(department => ({ value: department.id, label: department.name }))}
                />
              </div>
            )}
            deleteHint={role => {
              const count = roleStaffCount(role.id);
              return count > 0 ? `Folosit de ${count} ${count === 1 ? 'angajat' : 'angajați'}` : undefined;
            }}
            onDelete={removeRole}
            onAdd={addRole}
            addLabel="+ Adaugă funcția"
            editLabel="Editează funcțiile"
            onEnterEdit={() => setRolesMode('edit')}
            dirty={rolesDirty}
            saving={savingRoles}
            onSave={() => void saveRolesSection()}
            onCancel={discardRoleChanges}
            footerNote="Ștergerea apare doar la funcțiile fără angajați. Funcțiile se sincronizează între filiale și intră în backup."
            emptyState={<p className={styles.settingsHint}>Fără funcții adăugate.</p>}
          />
        </div>
      </Drawer>
      {unsavedGuard.confirmDialog}
    </>
  );
}
