import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PinGate } from './PinGate';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('PinGate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fără PIN corect salariile nu se randează; după deblocare apare lista lunii', async () => {
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
      <PinGate>
        <p>Lista lunii</p>
      </PinGate>,
    );

    expect(await screen.findByText('Salariile sunt protejate')).toBeInTheDocument();
    expect(screen.queryByText('Lista lunii')).not.toBeInTheDocument();

    const input = screen.getByLabelText('PIN administrator');
    await userEvent.type(input, '0000{enter}');
    expect(await screen.findByText('PIN greșit.')).toBeInTheDocument();
    expect(screen.queryByText('Lista lunii')).not.toBeInTheDocument();

    await userEvent.type(input, '1234{enter}');
    expect(await screen.findByText('Lista lunii')).toBeInTheDocument();
  });
});
