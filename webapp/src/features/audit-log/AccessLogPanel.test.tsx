import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessLogPanel } from './AccessLogPanel';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const todayIso = new Date().toISOString();

describe('AccessLogPanel (§7, 36g — fila „Acces")', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('arată evenimentele access.* grupate pe zi, cu eticheta modulului și calculatorul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit/access')
          return jsonResponse({
            entries: [
              {
                id: 2,
                occurredAt: todayIso,
                action: 'access.blocked',
                recordType: null,
                recordId: 'payments',
                before: null,
                after: null,
                deviceId: 'dev-1',
                deviceName: 'Calculator Recepție',
              },
              {
                id: 1,
                occurredAt: todayIso,
                action: 'access.pin_ok',
                recordType: null,
                recordId: null,
                before: null,
                after: null,
                deviceId: null,
                deviceName: null,
              },
            ],
            nextBeforeEntryId: null,
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(<AccessLogPanel />);

    expect(await screen.findByText('Acces respins')).toBeInTheDocument();
    expect(screen.getByText('Achitări')).toBeInTheDocument();
    expect(screen.getByText('Calculator Recepție')).toBeInTheDocument();
    expect(screen.getByText('PIN corect')).toBeInTheDocument();
    expect(screen.getByText('Acest calculator')).toBeInTheDocument();
  });

  it('un profil restrâns (403 pe /api/audit/access) arată mesajul, nu o eroare brută', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Acest calculator nu are acces la acest modul.' }, false, 403)),
    );

    render(<AccessLogPanel />);

    expect(await screen.findByText('Acest calculator nu are acces la acest modul.')).toBeInTheDocument();
  });

  it('fără evenimente, arată starea goală fără declanșa R9 (text „Nu există…”, nu „Niciun…”)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ entries: [], nextBeforeEntryId: null })),
    );

    render(<AccessLogPanel />);

    expect(await screen.findByText('Nu există evenimente de acces înregistrate.')).toBeInTheDocument();
  });
});
