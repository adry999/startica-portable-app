import { describe, expect, it } from 'vitest';
import { buildVisitRecord, defaultVisitFormValues, type VisitFormValues } from './visit-form';
import type { Visit } from '@contracts/record-types.mjs';

const baseValues: VisitFormValues = {
  name: 'Andrei Popescu',
  birthDate: '2020-09-24',
  parent: 'Maria Popescu',
  phone: '0722000001',
  parent2: '',
  phone2: '',
  date: '2026-10-01',
  time: '10:00',
  status: 'Programată',
  desiredStartDate: '',
  desiredGroupId: '',
  source: 'Facebook',
  healthNotes: '',
  postVisitNotes: '',
  notes: '',
};

describe('defaultVisitFormValues', () => {
  it('întoarce valori implicite pentru o vizită nouă, cu data de azi și ora 10:00', () => {
    const values = defaultVisitFormValues(null, '2026-09-24');
    expect(values.date).toBe('2026-09-24');
    expect(values.time).toBe('10:00');
    expect(values.status).toBe('Programată');
    expect(values.name).toBe('');
  });

  it('precompletează din vizita existentă la editare', () => {
    const visit = {
      ...baseValues,
      id: 'VIZ-1',
      history: [],
      statusChangedAt: '2026-09-01T00:00:00Z',
      childId: '',
    } as unknown as Visit;
    const values = defaultVisitFormValues(visit, '2026-09-24');
    expect(values.name).toBe('Andrei Popescu');
    expect(values.date).toBe('2026-10-01');
  });
});

describe('buildVisitRecord', () => {
  it('la creare, scrie o singură intrare de history cu statutul Programată', () => {
    const record = buildVisitRecord(null, 'VIZ-1', baseValues);
    expect(record.status).toBe('Programată');
    expect(record.history).toHaveLength(1);
    expect(record.history[0].status).toBe('Programată');
    expect(record.history[0].date).toBe('2026-10-01');
    expect(record.name).toBe('Andrei Popescu');
  });

  it('schimbarea datei sau orei la editare reprogramează vizita (readuce statutul la Programată și adaugă în history)', () => {
    const previous = buildVisitRecord(null, 'VIZ-1', baseValues);
    const rescheduled = buildVisitRecord(previous, previous.id, { ...baseValues, date: '2026-10-15', time: '14:00' });
    expect(rescheduled.date).toBe('2026-10-15');
    expect(rescheduled.time).toBe('14:00');
    expect(rescheduled.status).toBe('Programată');
    expect(rescheduled.history).toHaveLength(2);
  });

  it('fără schimbare de dată/oră, editarea altor câmpuri nu adaugă în history', () => {
    const previous = buildVisitRecord(null, 'VIZ-1', baseValues);
    const updated = buildVisitRecord(previous, previous.id, { ...baseValues, phone: '0722999999' });
    expect(updated.phone).toBe('0722999999');
    expect(updated.history).toHaveLength(1);
  });

  it('schimbarea statutului din formular scrie o intrare nouă în history', () => {
    const previous = buildVisitRecord(null, 'VIZ-1', baseValues);
    const done = buildVisitRecord(previous, previous.id, { ...baseValues, status: 'Efectuată' });
    expect(done.status).toBe('Efectuată');
    expect(done.history).toHaveLength(2);
    expect(done.history[1].status).toBe('Efectuată');
  });

  it('reprogramare și schimbare de statut simultane: reprogramarea se aplică întâi, statutul ales rămâne peste ea', () => {
    const previous = buildVisitRecord(null, 'VIZ-1', baseValues); // Programată
    const efectuata = buildVisitRecord(previous, previous.id, { ...baseValues, status: 'Efectuată' });
    const rescheduledAndDone = buildVisitRecord(efectuata, efectuata.id, {
      ...baseValues,
      date: '2026-10-20',
      status: 'Efectuată',
    });
    // rescheduleVisit readuce la 'Programată'; applyVisitStatus îl duce apoi la 'Efectuată' din nou.
    expect(rescheduledAndDone.date).toBe('2026-10-20');
    expect(rescheduledAndDone.status).toBe('Efectuată');
  });

  it('grupa dorită goală devine null, nu string gol', () => {
    const record = buildVisitRecord(null, 'VIZ-1', { ...baseValues, desiredGroupId: '' });
    expect(record.desiredGroupId).toBeNull();
  });
});
