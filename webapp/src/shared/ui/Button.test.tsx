import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('randează conținutul și folosește varianta primary implicit', () => {
    render(<Button>Salvează</Button>);
    const button = screen.getByRole('button', { name: 'Salvează' });
    expect(button.className).toMatch(/primary/);
  });

  it('aplică varianta cerută', () => {
    render(<Button variant="ghost">Anulează</Button>);
    expect(screen.getByRole('button', { name: 'Anulează' }).className).toMatch(/ghost/);
  });

  it('declanșează onClick când e apăsat', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Adaugă</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respectă disabled', () => {
    render(<Button disabled>Trimite</Button>);
    expect(screen.getByRole('button', { name: 'Trimite' })).toBeDisabled();
  });

  it('folosește type="submit" când e cerut explicit', () => {
    render(<Button type="submit">Confirmă</Button>);
    expect(screen.getByRole('button', { name: 'Confirmă' })).toHaveAttribute('type', 'submit');
  });

  it('aplică dimensiunea lg pentru acțiunea principală a paginii', () => {
    render(<Button size="lg">Salvează asocierile</Button>);
    expect(screen.getByRole('button', { name: 'Salvează asocierile' }).className).toMatch(/lg/);
  });
});
