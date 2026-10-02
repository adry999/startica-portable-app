import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { completProfile, normalizeProfile } from '#shared/domain/computer-profile.mjs';
import { ProfileEditor } from './ProfileEditor';

describe('ProfileEditor (§5.3, 36a/36b)', () => {
  it('arată cele 5 preset-uri, cu Complet selectat implicit', () => {
    render(<ProfileEditor value={completProfile()} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Profilul calculatorului' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Complet/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Educator/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('pe un preset fix arată rezumatul modulelor cu acces, nu matricea', () => {
    render(<ProfileEditor value={normalizeProfile({ preset: 'educator' })} onChange={vi.fn()} />);
    expect(screen.getByText('Pe acest calculator')).toBeInTheDocument();
    expect(screen.getByText('Prezența')).toBeInTheDocument();
    expect(screen.getByText('Modifică')).toBeInTheDocument();
    // Un modul fără acces (ex. Achitări) nu apare în rezumat.
    expect(screen.queryByText('Achitări')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /Acces la/ })).not.toBeInTheDocument();
  });

  it('click pe un alt preset cheamă onChange cu modulele preset-ului ales', async () => {
    const onChange = vi.fn();
    render(<ProfileEditor value={completProfile()} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /Bazin/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ preset: 'bazin', modules: expect.objectContaining({ pool: 2, children: 1 }) }),
    );
  });

  it('Personalizat arată matricea pe module, cu Administrare blocată la „Nu vede”', () => {
    render(<ProfileEditor value={normalizeProfile({ preset: 'personalizat' })} onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Acces la Copii' })).toBeInTheDocument();
    expect(screen.getAllByText('Nu vede').length).toBeGreaterThan(0);
    // Administrare nu are control interactiv, doar o pastilă fixă.
    expect(screen.queryByRole('radiogroup', { name: 'Acces la Administrare, Salarii, Sincronizare' })).toBeNull();
  });

  it('schimbarea accesului unui modul în matrice cheamă onChange cu noul nivel', async () => {
    const onChange = vi.fn();
    render(<ProfileEditor value={normalizeProfile({ preset: 'personalizat' })} onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Acces la Prezența' });
    await userEvent.click(within(group).getByRole('radio', { name: 'Modifică' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ modules: expect.objectContaining({ attendance: 2 }) }),
    );
  });

  it('comutatorul de PIN e dezactivat cât timp modulul e „Nu vede”', () => {
    render(<ProfileEditor value={normalizeProfile({ preset: 'personalizat' })} onChange={vi.fn()} />);
    const pinToggle = screen.getByRole('switch', { name: 'PIN la intrare pe Achitări' });
    expect(pinToggle).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <ProfileEditor value={normalizeProfile({ preset: 'personalizat' })} onChange={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
