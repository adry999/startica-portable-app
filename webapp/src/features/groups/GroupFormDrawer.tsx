import { useEffect, useState } from 'react';
import { Drawer } from '@shared/ui';
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

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(name, capacityRaw);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      title="Adaugă: grupă"
      width={420}
      onClose={onClose}
      footer={
        <button type="submit" form="group-form-drawer" className={styles.btnPrimary} disabled={submitting}>
          Salvează
        </button>
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
