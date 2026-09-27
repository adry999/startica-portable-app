import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('randează filtrele active și declanșează „Șterge filtrele” (varianta implicită no-results)', async () => {
    const onClearFilters = vi.fn();
    render(
      <EmptyState
        title="Niciun rezultat pentru „Popescu”"
        activeFilters={['Arhivați', 'Grupa Mars']}
        onClearFilters={onClearFilters}
      />,
    );
    expect(screen.getByText('Filtre active: Arhivați · Grupa Mars')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Șterge filtrele' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('nu arată „Șterge filtrele” fără onClearFilters', () => {
    render(<EmptyState title="Niciun rezultat" />);
    expect(screen.queryByRole('button', { name: 'Șterge filtrele' })).not.toBeInTheDocument();
  });

  it('randează varianta resolved cu textul în tonul mint', () => {
    render(
      <EmptyState
        variant="resolved"
        title="Totul e rezolvat"
        description="Nicio achitare fără copil asociat."
      />,
    );
    expect(screen.getByText('Totul e rezolvat')).toBeInTheDocument();
    expect(screen.getByText('Nicio achitare fără copil asociat.')).toBeInTheDocument();
  });

  it('randează CTA-ul din varianta first-step și declanșează onClick', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        variant="first-step"
        title="Nicio cheltuială în septembrie"
        action={{ label: '+ Cheltuială nouă', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Cheltuială nouă' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
