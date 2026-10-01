import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SelectableTile } from './SelectableTile';

describe('SelectableTile', () => {
  it('randează un buton real, cu conținutul dat', () => {
    render(<SelectableTile aria-label="Copil">Maria Ionescu</SelectableTile>);
    const tile = screen.getByRole('button', { name: 'Copil' });
    expect(tile.tagName).toBe('BUTTON');
    expect(tile).toHaveTextContent('Maria Ionescu');
  });

  it('apelează onClick la clic', async () => {
    const onClick = vi.fn();
    render(
      <SelectableTile aria-label="Copil" onClick={onClick}>
        Maria
      </SelectableTile>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copil' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('selected adaugă marcajul vizual', () => {
    render(
      <SelectableTile aria-label="Copil" selected>
        Maria
      </SelectableTile>,
    );
    expect(screen.getByRole('button', { name: 'Copil' }).className).toMatch(/selected/);
  });

  it('className custom se adaugă, nu înlocuiește reset-ul', () => {
    render(
      <SelectableTile aria-label="Copil" className="tile-custom">
        Maria
      </SelectableTile>,
    );
    expect(screen.getByRole('button', { name: 'Copil' }).className).toMatch(/tile-custom/);
  });

  it('disabled dezactivează butonul', () => {
    render(
      <SelectableTile aria-label="Copil" disabled>
        Maria
      </SelectableTile>,
    );
    expect(screen.getByRole('button', { name: 'Copil' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<SelectableTile aria-label="Copil">Maria</SelectableTile>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
