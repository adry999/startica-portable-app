import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { GlobalSearch, type GlobalSearchResult } from './GlobalSearch';

describe('GlobalSearch', () => {
  it('nu arată panoul de rezultate cât timp inputul nu are focus', () => {
    const results: GlobalSearchResult[] = [
      { key: 'c1', label: 'Ionescu Maria', category: 'Copil', onSelect: () => {} },
    ];
    render(<GlobalSearch value="Ion" onChange={() => {}} results={results} />);
    expect(screen.queryByText('Ionescu Maria')).not.toBeInTheDocument();
  });

  it('arată rezultatele la focus, cu categoria fiecăruia', async () => {
    const user = userEvent.setup();
    const results: GlobalSearchResult[] = [
      { key: 'c1', label: 'Ionescu Maria', category: 'Copil', onSelect: () => {} },
    ];
    render(<GlobalSearch value="Ion" onChange={() => {}} results={results} />);

    await user.click(screen.getByRole('searchbox', { name: 'Căutare globală' }));

    expect(screen.getByText('Ionescu Maria')).toBeInTheDocument();
    expect(screen.getByText('Copil')).toBeInTheDocument();
  });

  it('arată „Se caută…” cât timp loading e adevărat, chiar fără rezultate', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch value="Ion" onChange={() => {}} results={[]} loading />);

    await user.click(screen.getByRole('searchbox', { name: 'Căutare globală' }));

    expect(screen.getByText('Se caută…')).toBeInTheDocument();
  });

  it('clic pe un rezultat cheamă onSelect-ul acelui rezultat', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const results: GlobalSearchResult[] = [{ key: 'c1', label: 'Ionescu Maria', onSelect }];
    render(<GlobalSearch value="Ion" onChange={() => {}} results={results} />);

    await user.click(screen.getByRole('searchbox', { name: 'Căutare globală' }));
    await user.click(screen.getByText('Ionescu Maria'));

    expect(onSelect).toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const results: GlobalSearchResult[] = [{ key: 'c1', label: 'Ionescu Maria', onSelect: () => {} }];
    const { container } = render(<GlobalSearch value="Ion" onChange={() => {}} results={results} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
