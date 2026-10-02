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

  it('aplică varianta mint pentru acțiunea pozitivă a WeekFillBar (41b)', () => {
    render(<Button variant="mint">Toți prezenți L–V</Button>);
    expect(screen.getByRole('button', { name: 'Toți prezenți L–V' }).className).toMatch(/mint/);
  });

  it('aplică varianta danger pentru acțiuni distructive în text', () => {
    render(<Button variant="danger">Șterge</Button>);
    expect(screen.getByRole('button', { name: 'Șterge' }).className).toMatch(/danger/);
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

  it('cât `loading` e adevărat, butonul e dezactivat, aria-busy și arată un Spinner', () => {
    const { container } = render(<Button loading>Salvez…</Button>);
    const button = container.querySelector('button')!;
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('tone="inherit" adaugă clasa toneInherit (culoarea vine de la părinte)', () => {
    render(
      <Button variant="link" tone="inherit">
        Vezi lista →
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Vezi lista →' }).className).toMatch(/toneInherit/);
  });

  it('`loading` ignoră clicurile', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading onClick={onClick}>
        Salvez…
      </Button>,
    );
    await userEvent.click(container.querySelector('button')!);
    expect(onClick).not.toHaveBeenCalled();
  });
});
