import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('arată titlul', () => {
    render(<PageHeader title="Copii" />);
    expect(screen.getByRole('heading', { name: 'Copii' })).toBeInTheDocument();
  });

  it('arată doar secțiunile primite — restul lipsesc din DOM', () => {
    render(<PageHeader title="Copii" primaryAction={<button type="button">+ Copil nou</button>} />);
    expect(screen.getByRole('button', { name: '+ Copil nou' })).toBeInTheDocument();
    expect(screen.queryByText('Exportă')).not.toBeInTheDocument();
  });

  it('randează mod, stepper, secundare și primară în ordinea din spec', () => {
    render(
      <PageHeader
        title="Copii"
        mode={<span>Tabel/Card</span>}
        stepper={<span>Septembrie 2026</span>}
        secondaryActions={<button type="button">Exportă</button>}
        primaryAction={<button type="button">+ Copil nou</button>}
      />,
    );

    const header = screen.getByRole('heading', { name: 'Copii' }).parentElement;
    const texts = Array.from(header?.querySelectorAll('h1, span, button') ?? []).map(el => el.textContent);
    expect(texts).toEqual(['Copii', 'Tabel/Card', 'Septembrie 2026', 'Exportă', '+ Copil nou']);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <PageHeader
        title="Copii"
        secondaryActions={<button type="button">Exportă</button>}
        primaryAction={<button type="button">+ Copil nou</button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
