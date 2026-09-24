import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLogPage } from './AuditLogPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const page1 = {
  entries: [
    {
      id: 2,
      occurredAt: '2026-09-20T10:00:00.000Z',
      action: 'completare-taxe',
      recordType: 'children',
      recordId: 'c1',
      before: { fee: 1000 },
      after: { fee: 1500 },
    },
  ],
  nextBeforeEntryId: 1,
};

const page2 = {
  entries: [
    {
      id: 1,
      occurredAt: '2026-09-19T10:00:00.000Z',
      action: 'creare',
      recordType: 'children',
      recordId: 'c1',
      before: null,
      after: { fee: 1000 },
    },
  ],
  nextBeforeEntryId: null,
};

describe('AuditLogPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare, apoi intrarea din istoric', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(<AuditLogPage />);
    expect(screen.getByText('Se încarcă istoricul…')).toBeInTheDocument();

    expect(await screen.findByText(/completare-taxe/)).toBeInTheDocument();
  });

  it('"Mai multe" încarcă pagina următoare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/audit') return jsonResponse(page1);
        if (path === '/api/audit?beforeEntryId=1') return jsonResponse(page2);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(<AuditLogPage />);
    const user = userEvent.setup();

    await screen.findByText(/completare-taxe/);
    await user.click(screen.getByText('Mai multe'));

    await waitFor(() => expect(screen.getByText(/creare/)).toBeInTheDocument());
  });
});
