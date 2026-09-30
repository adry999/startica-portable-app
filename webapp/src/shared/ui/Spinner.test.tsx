import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('are rol status cu eticheta implicită', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
  });

  it('acceptă o etichetă custom', () => {
    render(<Spinner ariaLabel="Se salvează…" />);
    expect(screen.getByRole('status', { name: 'Se salvează…' })).toBeInTheDocument();
  });

  it('aplică clasa de mărime corespunzătoare', () => {
    render(<Spinner size={40} />);
    expect(screen.getByRole('status').className).toMatch(/size40/);
  });

  it('folosește mărimea implicită 24 când nu e specificată', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').className).toMatch(/size24/);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
