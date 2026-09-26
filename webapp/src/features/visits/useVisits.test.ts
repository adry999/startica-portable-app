import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useVisits } from './useVisits';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Datele fixturii sunt relative la „azi" real (nu valori fixe): hook-ul își pornește
// luna calendarului din today(), deci o dată fixă „îngheață" corect doar în ziua
// scrierii testului și devine flaky pe măsură ce trece timpul (ca la ziua de naștere
// din useDashboard.test.ts — nu repetăm aceeași greșeală aici).
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const now = new Date();
const TODAY = isoDate(now);
const CURRENT_MONTH = TODAY.slice(0, 7);
const NEXT_MONTH = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 15)).slice(0, 7);
const PREVIOUS_MONTH = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 15)).slice(0, 7);
const OTHER_MONTH_DATE = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const EMPTY_DATE = isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 10));

const fixtureState = {
  children: [],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 15 }],
  categories: [],
  visits: [
    {
      id: 'VIZ-1',
      name: 'Andrei Popescu',
      parent: 'Maria Popescu',
      phone: '0722000001',
      date: TODAY,
      time: '10:00',
      status: 'Programată',
      statusChangedAt: `${TODAY}T10:00:00.000Z`,
      history: [{ at: `${TODAY}T10:00:00.000Z`, status: 'Programată', date: TODAY, time: '10:00' }],
      desiredGroupId: null,
      childId: '',
      archived: false,
    },
    {
      id: 'VIZ-2',
      name: 'Maria Ionescu',
      parent: 'Ioana Ionescu',
      phone: '',
      date: TODAY,
      time: '11:30',
      status: 'Efectuată',
      statusChangedAt: `${TODAY}T10:00:00.000Z`,
      history: [],
      desiredGroupId: 'g1',
      childId: '',
      archived: false,
    },
    {
      id: 'VIZ-3',
      name: 'Ionuț Marin',
      parent: 'Elena Marin',
      phone: '',
      date: OTHER_MONTH_DATE,
      time: '09:00',
      status: 'Renunțat',
      statusChangedAt: `${OTHER_MONTH_DATE}T10:00:00.000Z`,
      history: [],
      desiredGroupId: null,
      childId: '',
      archived: true,
      archivedAt: `${OTHER_MONTH_DATE}T00:00:00.000Z`,
    },
  ],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('useVisits', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/record') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = {
            ...fixtureState,
            visits:
              body.mode === 'create'
                ? [...fixtureState.visits, body.record]
                : fixtureState.visits.map(v => (v.id === body.record.id ? body.record : v)),
          };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, visits: fixtureState.visits.filter(v => v.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/visits-enrol') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({
            state: fixtureState,
            revision: 2,
            updatedAt: '2026-09-23T10:05:00Z',
            childId: body.child.id,
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useVisits());
    expect(result.current.status).toBe('loading');
  });

  it('calculează pâlnia excluzând vizitele arhivate', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    expect(result.current.funnel.scheduled).toBe(1);
    expect(result.current.funnel.done).toBe(1);
    expect(result.current.funnel.withdrew).toBe(0); // VIZ-3 e arhivată
  });

  it('arată implicit doar vizitele din luna curentă', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    expect(result.current.rows.map(r => r.id)).toEqual(['VIZ-1', 'VIZ-2']);
  });

  it('„Arhivate" arată doar vizitele arhivate, nu și pe cele active', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    act(() => result.current.setAllMonths(true));
    act(() => result.current.setShowArchived(true));
    expect(result.current.rows.map(r => r.id)).toEqual(['VIZ-3']);
  });

  it('filtrul de statut restrânge lista', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    act(() => result.current.setStatusFilter('Efectuată'));
    expect(result.current.rows.map(r => r.id)).toEqual(['VIZ-2']);
  });

  it('click pe o zi din calendar (selectedDate) restrânge lista la ziua aceea', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    act(() => result.current.setSelectedDate(TODAY));
    expect(result.current.rows).toHaveLength(2);
    act(() => result.current.setSelectedDate(EMPTY_DATE));
    expect(result.current.rows).toHaveLength(0);
  });

  it('selectarea unei zile din altă lună schimbă și luna calendarului afișat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    expect(result.current.month).toBe(CURRENT_MONTH);

    act(() => result.current.setSelectedDate(OTHER_MONTH_DATE));

    expect(result.current.selectedDate).toBe(OTHER_MONTH_DATE);
    expect(result.current.month).toBe(OTHER_MONTH_DATE.slice(0, 7));
  });

  it('goToNextMonth/goToPreviousMonth/goToToday schimbă luna calendarului și resetează ziua selectată', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    act(() => result.current.setSelectedDate(TODAY));

    act(() => result.current.goToNextMonth());
    expect(result.current.month).toBe(NEXT_MONTH);
    expect(result.current.selectedDate).toBeNull();

    act(() => result.current.goToPreviousMonth());
    act(() => result.current.goToPreviousMonth());
    expect(result.current.month).toBe(PREVIOUS_MONTH);

    act(() => result.current.goToToday());
    expect(result.current.month).toBe(CURRENT_MONTH);
  });

  it('calendarul grupează vizitele nearhivate pe ziua lor, sortate după oră', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    const day = result.current.weeks.flat().find(d => d.date === TODAY)!;
    expect(day.visits.map(v => v.id)).toEqual(['VIZ-1', 'VIZ-2']);
  });

  it('createVisit trimite /api/record cu type visits și mode create', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('visits');
      expect(body.mode).toBe('create');
      expect(body.record.name).toBe('Radu Ionescu');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() =>
      result.current.createVisit({
        name: 'Radu Ionescu',
        birthDate: '',
        parent: 'Vasile Ionescu',
        phone: '',
        parent2: '',
        phone2: '',
        date: '2026-09-25',
        time: '09:00',
        status: 'Programată',
        desiredStartDate: '',
        desiredGroupId: '',
        source: '',
        healthNotes: '',
        postVisitNotes: '',
        notes: '',
      }),
    );
  });

  it('applyQuickStatus trece vizita în noul statut', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    const visit = result.current.rows.find(v => v.id === 'VIZ-1')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.status).toBe('Efectuată');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.applyQuickStatus(visit, 'Efectuată'));
  });

  it('setArchived arhivează cu archivedAt setat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    const visit = result.current.rows.find(v => v.id === 'VIZ-1')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.archived).toBe(true);
      expect(body.record.archivedAt).not.toBeNull();
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.setArchived(visit, true));
  });

  it('deleteForever cheamă /api/record-delete cu type visits', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record-delete');
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('visits');
      expect(body.id).toBe('VIZ-3');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.deleteForever('VIZ-3'));
  });

  it('enrollChild trimite /api/visits-enrol cu fișa precompletată din vizită și întoarce childId', async () => {
    await loadedSession();
    const { result } = renderHook(() => useVisits());
    const visit = result.current.rows.find(v => v.id === 'VIZ-1')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/visits-enrol');
      const body = JSON.parse(options.body as string);
      expect(body.visitId).toBe('VIZ-1');
      expect(body.child.name).toBe('Andrei Popescu');
      expect(body.child.parent).toBe('Maria Popescu');
      expect(body.child.groupId).toBe('g1');
      expect(body.child.fee).toBe(1500);
      return jsonResponse({
        state: fixtureState,
        revision: 2,
        updatedAt: '2026-09-23T10:05:00Z',
        childId: body.child.id,
      });
    });

    const childId = await result.current.enrollChild(visit, {
      fee: '1500',
      groupId: 'g1',
      attendanceDate: '2026-10-01',
    });
    expect(childId).toMatch(/^ID-/);
  });
});
