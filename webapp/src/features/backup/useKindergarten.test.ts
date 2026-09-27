import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKindergarten, type KindergartenSettings } from './useKindergarten';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const initialSettings: KindergartenSettings = {
  name: 'Grădinița Curcubeu',
  displayName: '',
  idno: '1000600000000',
  administrator: 'Ciobanu Maria',
  address: 'str. Exemplu 12, Chișinău',
  phone: '+373 60 000 000',
  email: '',
  website: '',
  iban: '',
  bank: '',
  nextReceiptNumber: 148,
  receiptFormat: 'a5',
  signatureLabel: '',
  footerNote: '',
  logoDataUrl: '',
};

describe('useKindergarten', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/kindergarten' && !isPost) return jsonResponse(initialSettings);
        if (path === '/api/kindergarten' && isPost) {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({ ...initialSettings, ...body });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nu e ready înainte de încărcare, apoi expune setările salvate', async () => {
    const { result } = renderHook(() => useKindergarten());
    expect(result.current.ready).toBe(false);

    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.settings?.name).toBe('Grădinița Curcubeu');
    expect(result.current.settings?.nextReceiptNumber).toBe(148);
  });

  it('save trimite obiectul complet și actualizează starea locală', async () => {
    const { result } = renderHook(() => useKindergarten());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.save({ ...initialSettings, name: 'Grădinița Soarele' }));

    expect(result.current.settings?.name).toBe('Grădinița Soarele');
  });
});
