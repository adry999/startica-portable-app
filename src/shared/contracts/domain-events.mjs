// Payload-ul fiecărui eveniment este descris în domain-event-payloads.d.mts.
export const DomainEvent = Object.freeze({
  RecordsReloaded: 'records.reloaded',
  SelectedMonthChanged: 'selected-month.changed',
  PaymentsAssigned: 'payments.assigned',
});

export const DOMAIN_EVENT_NAMES = Object.freeze(Object.values(DomainEvent));
