import { normalizeRecord } from '@domain/record-schema.mjs';
import { rescheduleVisit, applyVisitStatus } from '#features/visits/domain/visit-status.mjs';
import type { Visit, VisitStatus } from '@contracts/record-types.mjs';

export interface VisitFormValues {
  name: string;
  birthDate: string;
  parent: string;
  phone: string;
  parent2: string;
  phone2: string;
  date: string;
  time: string;
  status: string;
  desiredStartDate: string;
  desiredGroupId: string;
  source: string;
  healthNotes: string;
  postVisitNotes: string;
  notes: string;
}

export function defaultVisitFormValues(visit: Visit | null, today: string): VisitFormValues {
  return {
    name: visit?.name ?? '',
    birthDate: visit?.birthDate ?? '',
    parent: visit?.parent ?? '',
    phone: visit?.phone ?? '',
    parent2: visit?.parent2 ?? '',
    phone2: visit?.phone2 ?? '',
    date: visit?.date ?? today,
    time: visit?.time ?? '10:00',
    status: visit?.status ?? 'Programată',
    desiredStartDate: visit?.desiredStartDate ?? '',
    desiredGroupId: visit?.desiredGroupId ?? '',
    source: visit?.source ?? '',
    healthNotes: visit?.healthNotes ?? '',
    postVisitNotes: visit?.postVisitNotes ?? '',
    notes: visit?.notes ?? '',
  };
}

/**
 * Echivalentul visit-editor-fields.mjs's `read()`: reprogramarea (dată/oră
 * schimbată) se aplică întâi, ca o schimbare simultană de statut din formular
 * să se aplice peste ea, nu să fie ștearsă de ea. La creare, `previous` nu are
 * `date`/`time`, deci reprogramarea se declanșează oricum și scrie singura
 * intrare inițială din `history` — nu e nevoie de o ramură separată de creare.
 */
export function buildVisitRecord(previous: Visit | null, id: string, values: VisitFormValues): Visit {
  const now = new Date().toISOString();
  const base: Partial<Visit> = previous ?? {
    id,
    status: 'Programată',
    history: [],
    statusChangedAt: now,
    childId: '',
  };

  let result = {
    ...base,
    status: base.status || 'Programată',
    history: base.history || [],
    statusChangedAt: base.statusChangedAt || now,
    notes: values.notes,
    name: values.name.trim(),
    birthDate: values.birthDate,
    parent: values.parent.trim(),
    phone: values.phone.trim(),
    parent2: values.parent2.trim(),
    phone2: values.phone2.trim(),
    desiredStartDate: values.desiredStartDate,
    desiredGroupId: values.desiredGroupId || null,
    source: values.source.trim(),
    healthNotes: values.healthNotes,
    postVisitNotes: values.postVisitNotes,
  } as Visit;

  result =
    values.date !== base.date || values.time !== base.time
      ? rescheduleVisit(result, { date: values.date, time: values.time }, now)
      : { ...result, date: values.date, time: values.time };

  const nextStatus = (values.status || result.status) as VisitStatus;
  if (nextStatus !== result.status) result = applyVisitStatus(result, nextStatus, now);

  return normalizeRecord('visits', result) as Visit;
}
