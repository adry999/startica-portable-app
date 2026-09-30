import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LockedContent } from './LockedContent';

describe('LockedContent', () => {
  afterEach(() => vi.useRealTimers());

  it('nu randează children cât timp e blocat, doar formularul de PIN', () => {
    render(
      <LockedContent
        unlocked={false}
        onUnlock={async () => ({ ok: false, message: '' })}
        title="Protejat"
        subtitle="Introdu PIN-ul."
        inputAriaLabel="PIN"
      >
        <p>Suma secretă: 1234 lei</p>
      </LockedContent>,
    );
    expect(screen.queryByText(/Suma secretă/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('PIN')).toBeInTheDocument();
  });

  it('randează children fără câmpul de PIN cât timp e deblocat', () => {
    render(
      <LockedContent
        unlocked
        onUnlock={async () => ({ ok: true, message: '' })}
        title="Protejat"
        subtitle="—"
        inputAriaLabel="PIN"
      >
        <p>Conținut</p>
      </LockedContent>,
    );
    expect(screen.getByText('Conținut')).toBeInTheDocument();
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
  });

  it('arată mesajul de eroare și încercările rămase după un PIN greșit', async () => {
    render(
      <LockedContent
        unlocked={false}
        onUnlock={async () => ({ ok: false, message: 'PIN greșit.' })}
        title="Protejat"
        subtitle="—"
        inputAriaLabel="PIN"
      >
        <p>Conținut</p>
      </LockedContent>,
    );
    const input = screen.getByLabelText('PIN');
    await userEvent.type(input, '0000{enter}');
    expect(await screen.findByText('PIN greșit.')).toBeInTheDocument();
    expect(screen.getByText('Mai ai 4 încercări.')).toBeInTheDocument();
  });

  it('se blochează local după maxAttempts greșeli, cu numărătoare inversă', async () => {
    render(
      <LockedContent
        unlocked={false}
        onUnlock={async () => ({ ok: false, message: 'PIN greșit.' })}
        title="Protejat"
        subtitle="—"
        inputAriaLabel="PIN"
        maxAttempts={2}
        lockoutMs={5000}
      >
        <p>Conținut</p>
      </LockedContent>,
    );
    const input = screen.getByLabelText('PIN');
    await userEvent.type(input, '0000{enter}');
    expect(await screen.findByText('Mai ai 1 încercări.')).toBeInTheDocument();
    await userEvent.type(input, '0000{enter}');
    expect(await screen.findByText(/Blocat \d+s/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('PIN')).toBeDisabled());
  });
});
