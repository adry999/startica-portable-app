import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SelectableRow } from './SelectableRow';

describe('SelectableRow', () => {
  it('randează un buton real, cu conținutul dat', () => {
    render(<SelectableRow aria-label="Rând">Rândul 1</SelectableRow>);
    const tile = screen.getByRole('button', { name: 'Rând' });
    expect(tile.tagName).toBe('BUTTON');
    expect(tile).toHaveTextContent('Rândul 1');
  });

  it('apelează onClick la clic', async () => {
    const onClick = vi.fn();
    render(
      <SelectableRow aria-label="Rând" onClick={onClick}>
        Rândul 1
      </SelectableRow>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rând' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('selected adaugă marcajul vizual', () => {
    render(
      <SelectableRow aria-label="Rând" selected>
        Rândul 1
      </SelectableRow>,
    );
    expect(screen.getByRole('button', { name: 'Rând' }).className).toMatch(/selected/);
  });

  it('className custom se adaugă, nu înlocuiește reset-ul', () => {
    render(
      <SelectableRow aria-label="Rând" className="tile-custom">
        Rândul 1
      </SelectableRow>,
    );
    expect(screen.getByRole('button', { name: 'Rând' }).className).toMatch(/tile-custom/);
  });

  it('disabled dezactivează butonul', () => {
    render(
      <SelectableRow aria-label="Rând" disabled>
        Rândul 1
      </SelectableRow>,
    );
    expect(screen.getByRole('button', { name: 'Rând' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<SelectableRow aria-label="Rând">Rândul 1</SelectableRow>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
