import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSmsTemplates } from './useSmsTemplates';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** O promisiune controlată din exterior — pentru a decide manual ordinea în care „sosesc” două cereri. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const defaultTemplate = {
  id: 't1',
  name: 'Reamintire restanță',
  body: 'Bună, {părinte}!',
  stripDiacritics: true,
  isDefault: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const customTemplate = {
  id: 't2',
  name: 'Personalizat',
  body: 'Text liber',
  stripDiacritics: false,
  isDefault: false,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

describe('useSmsTemplates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('încarcă șabloanele și expune șablonul implicit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsTemplates());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.templates).toHaveLength(2);
    expect(result.current.defaultTemplate?.id).toBe('t1');
  });

  it('expune usageCountById din răspuns, sau gol dacă lipsește', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-templates')
          return jsonResponse({ templates: [defaultTemplate, customTemplate], usageCountById: { t1: 5 } });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsTemplates());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.usageCountById).toEqual({ t1: 5 });
  });

  it('save trimite input-ul la /api/sms-template-save și reîmprospătează lista', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsTemplates());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-template-save') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.name).toBe('Nou');
        return jsonResponse({ ok: true, template: customTemplate });
      }
      if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.save({ name: 'Nou', body: 'Text', stripDiacritics: true, isDefault: false }));
    expect(result.current.templates).toHaveLength(2);
  });

  it('remove trimite id-ul la /api/sms-template-delete și reîmprospătează lista', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate, customTemplate] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsTemplates());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-template-delete') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.id).toBe('t2');
        return jsonResponse({ ok: true });
      }
      if (path === '/api/sms-templates') return jsonResponse({ templates: [defaultTemplate] });
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.remove('t2'));
    expect(result.current.templates).toHaveLength(1);
  });

  // M11: `cancelled` din efectul de montare protejează doar `catch`-ul — un răspuns de succes sosit
  // târziu (montare) putea suprascrie o reîmprospătare mai nouă (declanșată de save/remove).
  it('un răspuns de la montare sosit după save() nu suprascrie lista reîmprospătată', async () => {
    const mountDeferred = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    let templatesCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/sms-templates') {
          templatesCallCount += 1;
          if (templatesCallCount === 1) return mountDeferred.promise; // cererea de la montare, lentă
          return jsonResponse({ templates: [defaultTemplate, customTemplate] }); // reîmprospătarea din save(), rapidă
        }
        if (path === '/api/sms-template-save') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({ ok: true, template: { ...customTemplate, id: body.id ?? 't2' } });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsTemplates());
    expect(result.current.status).toBe('loading');

    await act(() => result.current.save({ name: 'Nou', body: 'Text', stripDiacritics: true, isDefault: false }));
    expect(result.current.templates).toHaveLength(2);

    await act(async () => {
      mountDeferred.resolve(jsonResponse({ templates: [] })); // lista veche, goală
      await Promise.resolve();
    });

    expect(result.current.templates).toHaveLength(2); // lista reîmprospătată de save() nu trebuie ștearsă
  });
});
