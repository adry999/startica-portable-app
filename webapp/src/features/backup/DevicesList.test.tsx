import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { normalizeProfile } from '#shared/domain/computer-profile.mjs';
import { DevicesList } from './DevicesList';
import type { SyncDevice } from './useSyncSettings';

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: { branches: [] } }),
}));

const DEVICE_COMPLET: SyncDevice = {
  id: 'd1',
  name: 'Laptop contabil',
  os: 'Windows',
  lastSeenAt: new Date().toISOString(),
  lastBranchId: null,
  revokedAt: null,
  me: true,
};

const DEVICE_EDUCATOR: SyncDevice = {
  id: 'd2',
  name: 'Calculator grupa Mars',
  os: 'Windows',
  lastSeenAt: new Date().toISOString(),
  lastBranchId: null,
  revokedAt: null,
  me: false,
  profile: normalizeProfile({ preset: 'educator' }),
};

describe('DevicesList (§5.3, 36c)', () => {
  it('arată profilul fiecărui calculator — implicit Complet dacă lipsește', () => {
    render(<DevicesList devices={[DEVICE_COMPLET, DEVICE_EDUCATOR]} onRevoke={vi.fn()} />);
    const row1 = screen.getByText('Laptop contabil').closest('div')?.parentElement as HTMLElement;
    const row2 = screen.getByText('Calculator grupa Mars').closest('div')?.parentElement as HTMLElement;
    expect(within(row1).getByText('Complet')).toBeInTheDocument();
    expect(within(row2).getByText('Educator')).toBeInTheDocument();
  });

  it('fără onChangeProfile nu arată „Schimbă” (apelant care nu-l expune)', () => {
    render(<DevicesList devices={[DEVICE_EDUCATOR]} onRevoke={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Schimbă' })).not.toBeInTheDocument();
  });

  it('„Schimbă” deschide dialogul cu profilul curent al calculatorului', async () => {
    render(<DevicesList devices={[DEVICE_EDUCATOR]} onRevoke={vi.fn()} onChangeProfile={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Schimbă' }));
    expect(screen.getByRole('dialog', { name: 'Schimbă profilul · Calculator grupa Mars' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Educator/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('„Salvează” trimite profilul ales și închide dialogul', async () => {
    const onChangeProfile = vi.fn().mockResolvedValue(undefined);
    render(<DevicesList devices={[DEVICE_EDUCATOR]} onRevoke={vi.fn()} onChangeProfile={onChangeProfile} />);
    await userEvent.click(screen.getByRole('button', { name: 'Schimbă' }));
    await userEvent.click(screen.getByRole('radio', { name: /Bazin/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    await waitFor(() => expect(onChangeProfile).toHaveBeenCalledTimes(1));
    expect(onChangeProfile.mock.calls[0][0]).toBe('d2');
    expect(onChangeProfile.mock.calls[0][1]).toEqual(expect.objectContaining({ preset: 'bazin' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('„Renunță” închide dialogul fără să cheme onChangeProfile', async () => {
    const onChangeProfile = vi.fn();
    render(<DevicesList devices={[DEVICE_EDUCATOR]} onRevoke={vi.fn()} onChangeProfile={onChangeProfile} />);
    await userEvent.click(screen.getByRole('button', { name: 'Schimbă' }));
    await userEvent.click(screen.getByRole('button', { name: 'Renunță' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChangeProfile).not.toHaveBeenCalled();
  });
});
