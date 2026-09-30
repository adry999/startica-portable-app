import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
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

  it('randează varianta done cu textul în tonul mint', () => {
    render(<EmptyState variant="done" title="Totul e rezolvat" description="Nicio achitare fără copil asociat." />);
    expect(screen.getByText('Totul e rezolvat')).toBeInTheDocument();
    expect(screen.getByText('Nicio achitare fără copil asociat.')).toBeInTheDocument();
  });

  it('randează CTA-ul din varianta first și declanșează onClick', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        variant="first"
        title="Nicio cheltuială în septembrie"
        action={{ label: '+ Cheltuială nouă', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Cheltuială nouă' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('randează varianta period, fără puncte, cu CTA opțional', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        variant="period"
        title="Nicio achitare în septembrie"
        action={{ label: '+ Achitare nouă', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Achitare nouă' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('size="compact" randează un rând simplu, fără puncte/chenar, acțiunea ca link', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <EmptyState size="compact" variant="first" title="Nicio notă încă." action={{ label: '+ Notă', onClick }} />,
    );
    expect(container.querySelector('[class*="dots"]')).not.toBeInTheDocument();
    const action = screen.getByRole('button', { name: '+ Notă' });
    expect(action.className).toMatch(/link/);
    await userEvent.click(action);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('size="compact" fără acțiune arată doar textul', () => {
    render(<EmptyState size="compact" title="Toți copiii au grupă." />);
    expect(screen.getByText('Toți copiii au grupă.')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<EmptyState variant="first" title="Nicio grupă încă" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
