import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { NoteList } from './NoteList';

describe('NoteList', () => {
  it('randează autorul, data și textul fiecărei note', () => {
    render(
      <NoteList
        notes={[
          { key: 'n1', author: 'Educator Rusu Ana', date: '12 septembrie 2026', text: 'Alergie nouă — nuci.' },
          { key: 'n2', author: 'Admin', date: '1 septembrie 2026', text: 'Contract reînnoit.' },
        ]}
      />,
    );

    expect(screen.getByText('Educator Rusu Ana')).toBeInTheDocument();
    expect(screen.getByText('12 septembrie 2026', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Alergie nouă — nuci.')).toBeInTheDocument();
    expect(screen.getByText('Contract reînnoit.')).toBeInTheDocument();
  });

  it('nu randează nimic în plus când lista e goală', () => {
    const { container } = render(<NoteList notes={[]} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <NoteList notes={[{ key: 'n1', author: 'Educator Rusu Ana', date: '12 septembrie 2026', text: 'Notă.' }]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
