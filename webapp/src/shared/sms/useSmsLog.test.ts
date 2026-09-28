import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shiftDays, today as todayFn } from '@domain/calendar-month.mjs';
import { useSmsLog } from './useSmsLog';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const entrySent = {
  id: 1,
  createdAt: '2026-09-20T10:00:00.000Z',
  childId: 'c1',
  recipientName: 'Maria',
  childName: 'Ion',
  phone: '+37369123456',
  text: 'Salut Ion',
  templateId: 'TPL-restanta',
  templateName: 'Reamintire restanță',
  month: '2026-09',
  source: 'notify',
  characters: 9,
  segments: 1,
  encoding: 'gsm-7',
  cost: '0.30',
  status: 'sent',
  providerId: 'p1',
  providerStatus: 'Queued',
  providerError: '',
  statusCheckedAt: '',
};

const entryDelivered = {
  ...entrySent,
  id: 2,
  childId: 'c2',
  recipientName: 'Elena',
  childName: 'Ana',
  phone: '+37369123457',
  status: 'delivered',
  templateId: 'TPL-alt',
  templateName: 'Altul',
};

const entryFailed = { ...entrySent, id: 3, childId: 'c3', recipientName: 'Dan', childName: 'Vlad', status: 'failed' };

const page = {
  entries: [entryDelivered, entrySent, entryFailed],
  stats: { sentThisMonth: 3, failedThisMonth: 1, segmentsThisMonth: 3, monthlyLimit: null },
  monthly: [{ month: '2026-09', sent: 2, segments: 2, failed: 1 }],
};

/** O promisiune controlată din exterior — pentru a decide manual când „răspunde” reîmprospătarea de stări. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function stubFetch(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      calls.push(path);
      if (path === '/api/sms-refresh-statuses') return jsonResponse({ updated: 0, entries: [] });
      if (path.startsWith('/api/sms-log')) return jsonResponse(overrides.page ?? page);
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  return calls;
}

describe('useSmsLog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('încarcă jurnalul cu after=30 zile implicit și reîmprospătează stările la montare', async () => {
    const calls = stubFetch();
    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.entries).toHaveLength(3);
    expect(calls.some(path => path === '/api/sms-refresh-statuses')).toBe(true);
    expect(calls.some(path => path.startsWith('/api/sms-log?after='))).toBe(true);
  });

  it('filtrează local pe segment: livrate/în curs/eșuate', async () => {
    stubFetch();
    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setSegment('delivered'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([2]);

    act(() => result.current.setSegment('inProgress'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([1]);

    act(() => result.current.setSegment('failed'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([3]);
  });

  it('filtrează local pe șablon și pe căutare', async () => {
    stubFetch();
    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setTemplateId('TPL-alt'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([2]);

    act(() => result.current.setTemplateId(null));
    act(() => result.current.setSearch('elena'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([2]);
  });

  it('templateOptions listează șabloanele distincte din rândurile încărcate', async () => {
    stubFetch();
    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.templateOptions).toEqual(
      expect.arrayContaining([
        { id: 'TPL-restanta', name: 'Reamintire restanță' },
        { id: 'TPL-alt', name: 'Altul' },
      ]),
    );
  });

  it('schimbarea perioadei reface cererea cu un alt after', async () => {
    const calls = stubFetch();
    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    calls.length = 0;

    act(() => result.current.setPeriod(7));
    await waitFor(() => expect(calls.some(path => path.startsWith('/api/sms-log?after='))).toBe(true));
  });

  // M11: reîmprospătarea de stări de la montare (`sms-refresh-statuses` → load(period)) capturează
  // `period` din closure-ul montării — dacă operatorul schimbă perioada înainte ca reîmprospătarea
  // să răspundă, reîncărcarea ei ulterioară nu trebuie să rescrie perioada nou aleasă cu cea veche.
  it('reîmprospătarea pornită la montare nu suprascrie perioada aleasă între timp', async () => {
    const pageA = { entries: [{ ...entrySent, id: 10 }], stats: page.stats, monthly: page.monthly };
    const pageB = { entries: [{ ...entrySent, id: 20 }], stats: page.stats, monthly: page.monthly };
    const after30 = shiftDays(todayFn(), -30);
    const after7 = shiftDays(todayFn(), -7);
    const refreshDeferred = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-refresh-statuses') return refreshDeferred.promise;
        if (path === `/api/sms-log?after=${after30}`) return jsonResponse(pageA);
        if (path === `/api/sms-log?after=${after7}`) return jsonResponse(pageB);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsLog());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.entries.map(entry => entry.id)).toEqual([10]); // pageA, perioada implicită (30)

    act(() => result.current.setPeriod(7));
    await waitFor(() => expect(result.current.entries.map(entry => entry.id)).toEqual([20])); // pageB

    // Reîmprospătarea pornită la montare răspunde abia acum, cu perioada veche (30) din closure.
    await act(async () => {
      refreshDeferred.resolve(jsonResponse({ updated: 0, entries: [] }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.entries.map(entry => entry.id)).toEqual([20]); // rămâne perioada aleasă
  });
});
