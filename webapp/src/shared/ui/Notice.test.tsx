import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('randează conținutul primit', () => {
    render(<Notice tone="info">Informație obișnuită.</Notice>);
    expect(screen.getByText('Informație obișnuită.')).toBeInTheDocument();
  });

  it('folosește tonul info implicit', () => {
    render(<Notice>Text</Notice>);
    expect(screen.getByText('Text').className).toMatch(/info/);
  });

  it('tonul error primește role="alert"', () => {
    render(<Notice tone="error">A apărut o eroare.</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('A apărut o eroare.');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Notice tone="done">Totul e la zi.</Notice>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
