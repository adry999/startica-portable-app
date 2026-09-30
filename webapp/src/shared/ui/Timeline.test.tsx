import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('randează fiecare intrare cu timestamp, titlu și descriere', () => {
    render(
      <Timeline
        entries={[
          { key: 't1', timestamp: '12 septembrie 2026, 14:30', title: 'Angajare', description: 'Contract semnat.' },
          { key: 't2', timestamp: '1 octombrie 2026, 09:00', title: 'Promovare' },
        ]}
      />,
    );

    expect(screen.getByText('12 septembrie 2026, 14:30')).toBeInTheDocument();
    expect(screen.getByText('Angajare')).toBeInTheDocument();
    expect(screen.getByText('Contract semnat.')).toBeInTheDocument();
    expect(screen.getByText('Promovare')).toBeInTheDocument();
  });

  it('păstrează ordinea intrărilor primite', () => {
    render(
      <Timeline
        entries={[
          { key: 't1', timestamp: '1', title: 'Primul' },
          { key: 't2', timestamp: '2', title: 'Al doilea' },
        ]}
      />,
    );

    const titles = screen.getAllByRole('listitem').map(item => item.textContent);
    expect(titles[0]).toContain('Primul');
    expect(titles[1]).toContain('Al doilea');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Timeline entries={[{ key: 't1', timestamp: '12 septembrie 2026', title: 'Angajare' }]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
