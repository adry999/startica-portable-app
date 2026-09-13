import type { MonthKey } from './record-types.mjs';

export interface DomainEventPayloads {
  'records.reloaded': { revision: number };
  'selected-month.changed': { month: MonthKey };
  'payments.assigned': { paymentIds: string[]; childIds: string[] };
}

export type DomainEventName = keyof DomainEventPayloads;

export interface DomainEventBus {
  subscribe<Name extends DomainEventName>(
    eventName: Name,
    listener: (payload: DomainEventPayloads[Name]) => unknown,
  ): () => void;
  publish<Name extends DomainEventName>(eventName: Name, payload: DomainEventPayloads[Name]): void;
}
