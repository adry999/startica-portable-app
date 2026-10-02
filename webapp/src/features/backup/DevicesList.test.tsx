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
  version: '1.6.3',
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
  version: null,
};

describe('DevicesList (§5.3, 36c)', () => {
  it('arată profilul fiecărui calculator — implicit Complet dacă lipsește', () => {
    render(<DevicesList devices={[DEVICE_COMPLET, DEVICE_EDUCATOR]} onRevoke={vi.fn()} />);
    const row1 = screen.getByText('Laptop contabil').closest('div')?.parentElement as HTMLElement;
    const row2 = screen.getByText('Calculator grupa Mars').closest('div')?.parentElement as HTMLElement;
    expect(within(row1).getByText('Complet')).toBeInTheDocument();
    expect(within(row2).getByText('Educator')).toBeInTheDocument();
  });

  it('§5.2 (37d): arată versiunea raportată, sau nimic dacă nu s-a conectat încă sub ea', () => {
    render(<DevicesList devices={[DEVICE_COMPLET, DEVICE_EDUCATOR]} onRevoke={vi.fn()} />);
    const row1 = screen.getByText('Laptop contabil').closest('div')?.parentElement as HTMLElement;
    const row2 = screen.getByText('Calculator grupa Mars').closest('div')?.parentElement as HTMLElement;
    expect(within(row1).getByText(/v1\.6\.3/)).toBeInTheDocument();
    expect(within(row2).queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  // F26/37d (PROMPT-11 §4.4): „oprite primele”/banner declinate — doar pastila pe rând, și doar
  // când pragul chiar e cunoscut (minVersion nenul).
  it('§4.4: calculator sub minVersion arată pastila roz „Versiune veche”', () => {
    render(<DevicesList devices={[DEVICE_COMPLET]} onRevoke={vi.fn()} minVersion="2.0.0" />);
    expect(screen.getByText('Versiune veche · sincronizare oprită')).toBeInTheDocument();
  });

  it('§4.4: fără minVersion cunoscut (niciun 426 primit încă), nicio pastilă', () => {
    render(<DevicesList devices={[DEVICE_COMPLET]} onRevoke={vi.fn()} />);
    expect(screen.queryByText(/Versiune veche/)).not.toBeInTheDocument();
  });

  it('§4.4: calculator fără versiune raportată încă (version: null) nu e marcat „veche”', () => {
    render(<DevicesList devices={[DEVICE_EDUCATOR]} onRevoke={vi.fn()} minVersion="2.0.0" />);
    expect(screen.queryByText(/Versiune veche/)).not.toBeInTheDocument();
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

  it('§5 (PROMPT-CLAUDE-CODE-10, punctul 4): fiecare preset are tonul lui, nu un singur „yellow” pentru toate', () => {
    const devices: SyncDevice[] = [
      { ...DEVICE_COMPLET, id: 'p-complet', profile: normalizeProfile({ preset: 'complet' }) },
      { ...DEVICE_COMPLET, id: 'p-educator', profile: normalizeProfile({ preset: 'educator' }) },
      { ...DEVICE_COMPLET, id: 'p-receptie', profile: normalizeProfile({ preset: 'receptie' }) },
      { ...DEVICE_COMPLET, id: 'p-bazin', profile: normalizeProfile({ preset: 'bazin' }) },
      { ...DEVICE_COMPLET, id: 'p-personalizat', profile: normalizeProfile({ preset: 'personalizat' }) },
    ];
    render(<DevicesList devices={devices} onRevoke={vi.fn()} />);

    expect(screen.getByText('Complet').className).toMatch(/orange/);
    expect(screen.getByText('Educator').className).toMatch(/mint/);
    expect(screen.getByText('Recepție').className).toMatch(/pink/);
    expect(screen.getByText('Bazin').className).toMatch(/yellow/);
    expect(screen.getByText('Personalizat').className).toMatch(/blue/);
  });
});
