import { useMemo } from 'react';
import { useAppSession } from '@shared/api/session';
import { sortByGroupOrder } from '@shared/format/group-order';
import { DEFAULT_SERVICE_ID } from '@domain/record-schema.mjs';
import type { RecordsSnapshot, Service } from '@contracts/record-types.mjs';

export type ServicesStatus = 'loading' | 'ready' | 'failed';

export interface ServiceView {
  id: string;
  name: string;
  tone: string;
  priceMode: 'free' | 'fixed';
  price?: number;
  hidden: boolean;
  system: boolean;
  /** Grădiniță — arată eticheta „implicit” lângă ea (10d, ALINIERE-DESIGN.md §B3). */
  isDefault: boolean;
  paymentsCount: number;
  order: number;
}

export interface ServiceInput {
  name: string;
  tone: string;
  priceMode: 'free' | 'fixed';
  price?: number;
}

export interface ServicesData {
  status: ServicesStatus;
  failureMessage: string;
  services: ServiceView[];
  busy: boolean;
  createService: (input: ServiceInput) => Promise<string>;
  updateService: (id: string, input: ServiceInput) => Promise<void>;
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  reorderServices: (draggedId: string, targetId: string) => Promise<void>;
}

/** Fila „Servicii” din Backup și setări (10d, ALINIERE-DESIGN.md §B3) — listă + reordonare, ca la Grupe
 * (`useGroups`): scrie `order` prin mutații obișnuite `/api/record`, fără rută dedicată de reordonare. */
export function useServices(): ServicesData {
  const session = useAppSession();
  const { state, ready, loading, saveError, busy: mutationInFlight, pending } = session.state;
  const records = state as RecordsSnapshot;
  const busy = mutationInFlight || Boolean(pending);

  /** Persistă ordinea 0..N-1 pentru serviciile a căror poziție s-a schimbat — ca la `useGroups.persistOrder`. */
  async function persistOrder(next: Service[]) {
    for (let index = 0; index < next.length; index++) {
      const service = next[index];
      if (service.order !== index) {
        await session.mutate('/api/record', {
          type: 'services',
          mode: 'update',
          record: { ...service, order: index },
        });
      }
    }
  }

  async function reorderServices(draggedId: string, targetId: string) {
    if (draggedId === targetId || busy) return;
    const current = sortByGroupOrder(records.services ?? []);
    const fromIndex = current.findIndex(service => service.id === draggedId);
    const toIndex = current.findIndex(service => service.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persistOrder(next);
  }

  async function createService(input: ServiceInput) {
    const name = input.name.trim();
    if (!name) throw new Error('Completează numele serviciului.');
    const existing = sortByGroupOrder(records.services ?? []);
    const id = `SVC-${crypto.randomUUID()}`;
    await session.mutate('/api/record', {
      type: 'services',
      mode: 'create',
      record: {
        id,
        name,
        tone: input.tone,
        priceMode: input.priceMode,
        ...(input.priceMode === 'fixed' ? { price: input.price } : {}),
        order: existing.length,
        system: false,
      },
    });
    return id;
  }

  async function updateService(id: string, input: ServiceInput) {
    const service = (records.services ?? []).find(candidate => candidate.id === id);
    if (!service) throw new Error('Serviciul nu mai există.');
    const name = input.name.trim();
    if (!name) throw new Error('Numele serviciului nu poate fi gol.');
    await session.mutate('/api/record', {
      type: 'services',
      mode: 'update',
      record: {
        ...service,
        // Id-ul serviciilor de sistem (Grădiniță/Bazin) nu se schimbă niciodată — doar `record.id`
        // rămas din `service` original garantează asta, numele/tonul/prețul rămân editabile.
        name,
        tone: input.tone,
        priceMode: input.priceMode,
        price: input.priceMode === 'fixed' ? input.price : undefined,
      },
    });
  }

  async function setHidden(id: string, hidden: boolean) {
    const service = (records.services ?? []).find(candidate => candidate.id === id);
    if (!service) throw new Error('Serviciul nu mai există.');
    // Grădinița/Bazinul nu se pot ascunde din UI — taxa lunară și Bazinul depind de ele (B3).
    if (service.system) throw new Error('Grădinița și Bazinul nu pot fi ascunse.');
    await session.mutate('/api/record', { type: 'services', mode: 'update', record: { ...service, hidden } });
  }

  const services = useMemo(() => {
    if (!ready) return [] as ServiceView[];
    const ordered = sortByGroupOrder(records.services ?? []);
    return ordered.map((service, index) => ({
      id: service.id,
      name: service.name,
      tone: service.tone,
      priceMode: service.priceMode,
      price: service.price,
      hidden: Boolean(service.hidden),
      system: service.system,
      isDefault: service.id === DEFAULT_SERVICE_ID,
      paymentsCount: records.payments.filter(payment => payment.service === service.id).length,
      order: index,
    }));
  }, [ready, records.services, records.payments]);

  return {
    status: ready ? 'ready' : loading || !saveError ? 'loading' : 'failed',
    failureMessage: saveError,
    services,
    busy,
    createService,
    updateService,
    setHidden,
    reorderServices,
  };
}
