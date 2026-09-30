import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SyncStatusCard } from './SyncStatusCard';

describe('SyncStatusCard', () => {
  it('arată mesajul dat', () => {
    render(<SyncStatusCard state="synced" message="Sincronizat acum 2 minute" />);
    expect(screen.getByText('Sincronizat acum 2 minute')).toBeInTheDocument();
  });

  it('arată Spinner cât timp starea e "syncing"', () => {
    render(<SyncStatusCard state="syncing" message="Se sincronizează…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('arată butonul „Reîncearcă” doar pe stare error, cu onRetry dat', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SyncStatusCard state="error" message="Eroare la sincronizare" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('nu arată „Reîncearcă” pe alte stări chiar dacă onRetry e dat', () => {
    render(<SyncStatusCard state="synced" message="Sincronizat" onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument();
  });

  it('nu arată „Reîncearcă” pe error fără onRetry', () => {
    render(<SyncStatusCard state="error" message="Eroare la sincronizare" />);
    expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<SyncStatusCard state="offline" message="Offline" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
