import { useEffect, useState } from 'react';
import { Button, Drawer } from '@shared/ui';
import { useDirtyForm } from '@shared/state/dirty-forms';
import styles from './GroupFormDrawer.module.css';

export interface GroupFormDrawerProps {
  open: boolean;
  onSubmit: (name: string, capacityRaw: string) => Promise<void>;
  onClose: () => void;
}

export function GroupFormDrawer({ open, onSubmit, onClose }: GroupFormDrawerProps) {
  const [name, setName] = useState('');
  const [capacityRaw, setCapacityRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setCapacityRaw('');
    }
  }, [open]);

  async function handleSubmit(): Promise<boolean> {
    if (submitting) return false;
    setSubmitting(true);
    try {
      await onSubmit(name, capacityRaw);
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  // Formularul e mereu „nou” (fără target de editare) — nesalvat înseamnă doar
  // că un câmp are text cât timp drawer-ul e deschis (13b).
  const dirty = open && (name !== '' || capacityRaw !== '');
  useDirtyForm(dirty ? { label: 'o grupă', save: handleSubmit } : null);

  return (
    <Drawer
      open={open}
      title="Adaugă: grupă"
      width={420}
      onClose={onClose}
      footer={
        <Button type="submit" form="group-form-drawer" disabled={submitting}>
          Salvează
        </Button>
      }
    >
      <form
        id="group-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          Nume grupă
          <input value={name} onChange={event => setName(event.target.value)} autoFocus />
        </label>
        <label className={styles.field}>
          Capacitate
          <input
            value={capacityRaw}
            onChange={event => setCapacityRaw(event.target.value)}
            type="number"
            min={1}
            max={1000}
          />
        </label>
      </form>
    </Drawer>
  );
}
