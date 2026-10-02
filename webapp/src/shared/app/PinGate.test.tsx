import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PinGate } from './PinGate';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('PinGate (§7, 36h — generalizat pentru orice modul din pinModules)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('arată titlul/subtitlul implicite cu eticheta modulului, cere PIN, apoi arată conținutul', async () => {
    let unlocked = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/personal/pin') return jsonResponse({ configured: true, unlocked });
        if (path === '/api/personal/pin/unlock') {
          const body = JSON.parse(options?.body as string) as { pin: string };
          if (body.pin === '1234') {
            unlocked = true;
            return jsonResponse({ ok: true });
          }
          return jsonResponse({ error: 'PIN greșit.' }, false, 403);
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(
      <PinGate label="Achitările">
        <p>Lista achitărilor</p>
      </PinGate>,
    );

    expect(await screen.findByText('Acces protejat cu PIN')).toBeInTheDocument();
    expect(screen.getByText('Achitările: introdu PIN-ul administrator (4–6 cifre).')).toBeInTheDocument();
    expect(screen.queryByText('Lista achitărilor')).not.toBeInTheDocument();

    const input = screen.getByLabelText('PIN administrator');
    await userEvent.type(input, '0000{enter}');
    expect(await screen.findByText('PIN greșit.')).toBeInTheDocument();
    expect(screen.queryByText('Lista achitărilor')).not.toBeInTheDocument();

    await userEvent.type(input, '1234{enter}');
    expect(await screen.findByText('Lista achitărilor')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6), blocat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/pin') return jsonResponse({ configured: true, unlocked: false });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const { container } = render(
      <PinGate label="Achitările">
        <p>Conținut</p>
      </PinGate>,
    );
    await screen.findByText('Acces protejat cu PIN');
    expect(await axe(container)).toHaveNoViolations();
  });

  // PROMPT-11 §4.1: numărătoarea locală = blocajul serverului (15 minute), nu implicitul de 60s.
  it('blocajul local după 5 greșeli arată 900s (15 minute, ca blocajul serverului)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/pin') return jsonResponse({ configured: true, unlocked: false });
        if (path === '/api/personal/pin/unlock') return jsonResponse({ error: 'PIN greșit.' }, false, 403);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(
      <PinGate label="Achitările">
        <p>Conținut</p>
      </PinGate>,
    );
    const input = await screen.findByLabelText('PIN administrator');
    for (let i = 0; i < 5; i++) {
      await userEvent.type(input, '0000{enter}');
    }
    expect(await screen.findByText('Blocat 900s — prea multe încercări greșite.')).toBeInTheDocument();
  });

  it('acceptă titlu/subtitlu proprii (folosit de Salarii, ca să-și păstreze formularea)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/pin') return jsonResponse({ configured: true, unlocked: true });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(
      <PinGate label="Salariile" title="Titlu propriu" subtitle="Subtitlu propriu">
        <p>Conținut</p>
      </PinGate>,
    );

    expect(await screen.findByText('Conținut')).toBeInTheDocument();
  });
});
