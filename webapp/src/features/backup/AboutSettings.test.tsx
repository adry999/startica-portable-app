import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AboutSettings } from './AboutSettings';

describe('AboutSettings', () => {
  it('arată titlul și toate grupele de module din meniu', () => {
    render(<AboutSettings />);
    expect(screen.getByText('Despre Startica')).toBeInTheDocument();
    expect(screen.getByText('Evidență')).toBeInTheDocument();
    expect(screen.getByText('Contabilitate')).toBeInTheDocument();
    expect(screen.getByText('De rezolvat')).toBeInTheDocument();
    expect(screen.getByText('Administrare')).toBeInTheDocument();
    expect(screen.getByText('Date, backup și sincronizare')).toBeInTheDocument();
  });

  it('fiecare modul e un Disclosure închis implicit, care se deschide la click', async () => {
    const user = userEvent.setup();
    render(<AboutSettings />);
    const details = screen.getByText('Dashboard').closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByText('Dashboard'));
    expect(details.open).toBe(true);
    expect(screen.getByText(/Rezumatul lunii curente/)).toBeInTheDocument();
  });

  it('secțiunea tehnică explică backup-ul și sincronizarea', async () => {
    const user = userEvent.setup();
    render(<AboutSettings />);
    await user.click(screen.getByText('Sincronizare între calculatoare'));
    expect(screen.getByText(/conflict pe care îl rezolvi tu/)).toBeInTheDocument();
  });

  it('fără încălcări axe', async () => {
    const { container } = render(<AboutSettings />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
