import { useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Drawer,
  Field,
  LoadingState,
  NumberInput,
  SegmentedControl,
  ServiceBadge,
  SettingsList,
  TextInput,
  TonePicker,
  Toggle,
  useToast,
} from '@shared/ui';
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

  if (data.status === 'loading') return <LoadingState />;
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

      <SettingsList
        items={data.services}
        ariaLabel="Servicii"
        isDraggable={() => !data.busy}
        onReorder={(draggedId, targetId) => void data.reorderServices(draggedId, targetId)}
        emptyMessage="Niciun serviciu încă."
        renderName={service => (
          <>
            <ServiceBadge service={service} />
            {service.isDefault && <Badge tone="neutral">implicit</Badge>}
          </>
        )}
        renderCount={service => `${service.paymentsCount} ${service.paymentsCount === 1 ? 'achitare' : 'achitări'}`}
        renderStatus={service => (
          <Badge tone={service.hidden ? 'neutral' : 'mint'}>{service.hidden ? 'Ascuns' : 'Activ'}</Badge>
        )}
        renderActions={service => (
          <>
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
          </>
        )}
      />

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
          <Field label="Nume" htmlFor="service-name">
            <TextInput
              id="service-name"
              value={form.name}
              autoFocus
              onChange={name => setForm({ ...form, name })}
              placeholder="ex. Excursie"
            />
          </Field>

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
            <Field label="Preț (lei)" htmlFor="service-price">
              <NumberInput
                id="service-price"
                min={1}
                step="0.01"
                value={form.price !== undefined ? String(form.price) : ''}
                onChange={value => setForm({ ...form, price: value ? Number(value) : undefined })}
              />
            </Field>
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
