import { useState, type FormEvent } from 'react';
import { Badge, Button, Drawer, SegmentedControl, ServiceBadge, TonePicker, Toggle, useToast } from '@shared/ui';
import { SERVICE_TONES } from '@domain/record-schema.mjs';
import { useServices, type ServiceInput, type ServiceView } from './useServices';
import backupStyles from './BackupPage.module.css';
import styles from './ServicesSettings.module.css';

function firstUnusedTone(services: ServiceView[]): string {
  const used = new Set(services.map(service => service.tone));
  return SERVICE_TONES.find(tone => !used.has(tone)) ?? SERVICE_TONES[0];
}

function formFromService(service: ServiceView): ServiceInput {
  return { name: service.name, tone: service.tone, priceMode: service.priceMode, price: service.price };
}

const PRICE_MODE_OPTIONS = [
  { value: 'free' as const, label: 'Liberă' },
  { value: 'fixed' as const, label: 'Preț fix' },
];

/** Fila „Servicii” din Backup și setări (10d, `Administrare.dc.html#10d`, ALINIERE-DESIGN.md §B3):
 * listă cu reordonare + Drawer 480 pentru serviciu nou/editare. */
export function ServicesSettings() {
  const data = useServices();
  const toast = useToast();
  const [drawerTarget, setDrawerTarget] = useState<ServiceView | 'new' | null>(null);
  const [form, setForm] = useState<ServiceInput>({ name: '', tone: SERVICE_TONES[0], priceMode: 'free' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function openCreate() {
    setForm({ name: '', tone: firstUnusedTone(data.services), priceMode: 'free' });
    setFormError('');
    setDrawerTarget('new');
  }

  function openEdit(service: ServiceView) {
    setForm(formFromService(service));
    setFormError('');
    setDrawerTarget(service);
  }

  function closeDrawer() {
    setDrawerTarget(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (drawerTarget === 'new') {
        await data.createService(form);
        toast.show({ message: 'Serviciul a fost creat.' });
      } else if (drawerTarget) {
        await data.updateService(drawerTarget.id, form);
        toast.show({ message: 'Serviciul a fost actualizat.' });
      }
      closeDrawer();
    } catch (error) {
      // Server-side: assertUniqueName respinge un nume duplicat — eroarea lui apare direct aici.
      setFormError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleHidden(service: ServiceView) {
    try {
      await data.setHidden(service.id, !service.hidden);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (data.status === 'loading') return <p className={backupStyles.notice}>Se încarcă…</p>;
  if (data.status === 'failed')
    return <p className={backupStyles.notice}>{data.failureMessage || 'Serviciile nu au putut fi încărcate.'}</p>;

  const priceInvalid = form.priceMode === 'fixed' && !(Number(form.price) > 0);

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <h3 className={backupStyles.panelTitle}>Servicii</h3>
        <Button variant="outline" onClick={openCreate}>
          + Serviciu
        </Button>
      </div>

      <div className={styles.list} role="list" aria-label="Servicii">
        {data.services.map(service => (
          <div
            key={service.id}
            role="listitem"
            className={`${styles.row} ${dragOverId === service.id ? styles.rowDragOver : ''}`}
            draggable={!data.busy}
            onDragStart={event => {
              event.dataTransfer.setData('text/plain', service.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              if (!event.dataTransfer.types.includes('text/plain')) return;
              event.preventDefault();
              setDragOverId(service.id);
            }}
            onDragLeave={event => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setDragOverId(null);
            }}
            onDrop={event => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData('text/plain');
              setDragOverId(null);
              void data.reorderServices(draggedId, service.id);
            }}
          >
            <span className={styles.handle} aria-hidden="true">
              ⋮⋮
            </span>
            <div className={styles.name}>
              <ServiceBadge service={service} />
              {service.isDefault && <Badge tone="neutral">implicit</Badge>}
            </div>
            <span className={styles.count}>
              {service.paymentsCount} {service.paymentsCount === 1 ? 'achitare' : 'achitări'}
            </span>
            <span className={styles.status}>
              <Badge tone={service.hidden ? 'neutral' : 'mint'}>{service.hidden ? 'Ascuns' : 'Activ'}</Badge>
            </span>
            <div className={styles.actions}>
              {!service.system && (
                <Toggle
                  checked={!service.hidden}
                  onChange={() => void toggleHidden(service)}
                  ariaLabel={service.hidden ? `Arată serviciul ${service.name}` : `Ascunde serviciul ${service.name}`}
                />
              )}
              <Button variant="outline" onClick={() => openEdit(service)}>
                Editează
              </Button>
            </div>
          </div>
        ))}
        {data.services.length === 0 && <p className={backupStyles.notice}>Niciun serviciu încă.</p>}
      </div>

      <p className={backupStyles.hint}>
        Un serviciu cu achitări nu se șterge, doar se ascunde — nu mai apare în Achitare nouă, rămâne în filtre și în
        istoricul plăților existente. Grădinița și Bazinul sunt fixe: nu se pot ascunde din această listă.
      </p>

      <Drawer
        open={drawerTarget !== null}
        title={drawerTarget === 'new' ? 'Serviciu nou' : `Editează ${drawerTarget?.name ?? ''}`}
        width={480}
        onClose={closeDrawer}
        footer={
          <Button type="submit" form="service-form-drawer" disabled={submitting || !form.name.trim() || priceInvalid}>
            {drawerTarget === 'new' ? 'Creează serviciul' : 'Salvează'}
          </Button>
        }
      >
        <form id="service-form-drawer" className={styles.form} onSubmit={event => void submit(event)}>
          <label className={backupStyles.field}>
            Nume
            <input
              value={form.name}
              autoFocus
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="ex. Excursie"
            />
          </label>

          <div className={backupStyles.field}>
            Culoare
            <TonePicker
              ariaLabel="Culoare"
              tones={SERVICE_TONES}
              value={form.tone}
              onChange={tone => setForm({ ...form, tone })}
            />
          </div>

          <div className={backupStyles.field}>
            Suma la achitare
            <SegmentedControl
              ariaLabel="Suma la achitare"
              value={form.priceMode}
              onChange={priceMode => setForm({ ...form, priceMode })}
              options={PRICE_MODE_OPTIONS}
            />
          </div>

          {form.priceMode === 'fixed' && (
            <label className={backupStyles.field}>
              Preț (lei)
              <input
                type="number"
                min={1}
                step="0.01"
                value={form.price ?? ''}
                onChange={event =>
                  setForm({ ...form, price: event.target.value ? Number(event.target.value) : undefined })
                }
              />
            </label>
          )}

          <div className={backupStyles.field}>
            Previzualizare
            <div>
              <ServiceBadge service={{ name: form.name.trim() || 'Serviciu nou', tone: form.tone }} />
            </div>
          </div>

          {formError && <p className={backupStyles.error}>{formError}</p>}
        </form>
      </Drawer>
    </div>
  );
}
