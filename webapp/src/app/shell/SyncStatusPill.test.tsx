import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SyncStatusPill } from './SyncStatusPill';

describe('SyncStatusPill', () => {
  it('randează eticheta primită, ca indicator simplu (fără onClick)', () => {
    render(<SyncStatusPill mode="synced" label="Sincronizat · 12:06" />);
    expect(screen.getByRole('status')).toHaveTextContent('Sincronizat · 12:06');
  });

  it('devine un buton accesibil când primește onClick', async () => {
    const onClick = vi.fn();
    render(<SyncStatusPill mode="offline" label="Fără internet" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fără internet' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Enter pe pastilă declanșează onClick, ca orice element cu rol de buton', async () => {
    const onClick = vi.fn();
    render(<SyncStatusPill mode="revoked" label="Deconectat de pe server" onClick={onClick} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
