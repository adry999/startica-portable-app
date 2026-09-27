import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSmsTemplates } from './useSmsTemplates';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
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
});
