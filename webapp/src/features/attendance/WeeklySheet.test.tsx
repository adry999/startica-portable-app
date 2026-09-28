import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Child, Group } from '@contracts/record-types.mjs';
import { buildWeeklySheetPages, sheetsForGroupCount, WeeklySheet, type WeeklySheetOptions } from './WeeklySheet';

const GROUP: Group = { id: 'g1', name: 'Mars', capacity: 20, educator: 'Ala Ursu' };

function makeChild(overrides: Partial<Child> & { id: string; name: string }): Child {
  return {
    parent: '',
    phone: '0700 111 222',
    groupId: 'g1',
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 1,
    birthDate: '2020-01-15',
    ...overrides,
  };
}

function childList(count: number): Child[] {
  return Array.from({ length: count }, (_, index) =>
    makeChild({ id: `c${index}`, name: `Copil ${String(index).padStart(2, '0')}` }),
  );
}

const DEFAULT_OPTIONS: WeeklySheetOptions = { showDetails: true, showNotes: true };
const STAFF_BY_ID = new Map();

describe('buildWeeklySheetPages', () => {
  it('14 copii → 14 rânduri cu nume + 2 rânduri libere, o singură foaie', () => {
    const pages = buildWeeklySheetPages(GROUP, childList(14), STAFF_BY_ID);
    expect(pages).toHaveLength(1);
    expect(pages[0].children).toHaveLength(14);
    expect(pages[0].emptyRowCount).toBe(2);
  });

  it('0 copii → 16 rânduri libere, o singură foaie', () => {
    const pages = buildWeeklySheetPages(GROUP, [], STAFF_BY_ID);
    expect(pages).toHaveLength(1);
    expect(pages[0].children).toHaveLength(0);
    expect(pages[0].emptyRowCount).toBe(16);
  });

  it('20 de copii → 2 foi, notițele apar doar pe ultima', () => {
    const pages = buildWeeklySheetPages(GROUP, childList(20), STAFF_BY_ID);
    expect(pages).toHaveLength(2);
    expect(pages[0].children).toHaveLength(16);
    expect(pages[0].emptyRowCount).toBe(0);
    expect(pages[0].isLastPage).toBe(false);
    expect(pages[1].children).toHaveLength(4);
    expect(pages[1].emptyRowCount).toBe(12);
    expect(pages[1].isLastPage).toBe(true);
  });

  it('numărul de foi calculat pentru buton se potrivește cu foile randate', () => {
    for (const count of [0, 1, 14, 16, 17, 20, 32, 33]) {
      const pages = buildWeeklySheetPages(GROUP, childList(count), STAFF_BY_ID);
      expect(pages).toHaveLength(sheetsForGroupCount(count));
    }
  });
});

describe('WeeklySheet — randare', () => {
  it('fără opțiunea Alergii, coloana de detalii lipsește', () => {
    const page = buildWeeklySheetPages(GROUP, childList(3), STAFF_BY_ID)[0];
    const { rerender } = render(
      <WeeklySheet
        page={page}
        weekStart="2026-09-28"
        branchName="Buiucani"
        kindergarten={null}
        options={DEFAULT_OPTIONS}
      />,
    );
    expect(screen.getByText('Alergii · detalii')).toBeInTheDocument();

    rerender(
      <WeeklySheet
        page={page}
        weekStart="2026-09-28"
        branchName="Buiucani"
        kindergarten={null}
        options={{ ...DEFAULT_OPTIONS, showDetails: false }}
      />,
    );
    expect(screen.queryByText('Alergii · detalii')).not.toBeInTheDocument();
  });

  it('niciun număr de telefon nu apare în DOM-ul foii', () => {
    const children = childList(5).map(child => ({ ...child, phone: '079900' + child.id, healthNotes: 'astm ușor' }));
    const page = buildWeeklySheetPages(GROUP, children, STAFF_BY_ID)[0];
    const { container } = render(
      <WeeklySheet
        page={page}
        weekStart="2026-09-28"
        branchName="Buiucani"
        kindergarten={null}
        options={DEFAULT_OPTIONS}
      />,
    );
    expect(container.textContent ?? '').not.toContain('079900');
  });

  it('deduce eticheta ALERGIE/MEDICAL din healthNotes, fără nume de părinți', () => {
    const children = [
      makeChild({ id: 'a1', name: 'Ana', healthNotes: 'Alergie la nuci', parent: 'Maria Ana' }),
      makeChild({ id: 'a2', name: 'Bogdan', healthNotes: 'Astm, folosește inhalator', parent: 'Ion Bogdan' }),
      makeChild({ id: 'a3', name: 'Cristi', healthNotes: 'Nimic special', parent: 'Vasile Cristi' }),
    ];
    const page = buildWeeklySheetPages(GROUP, children, STAFF_BY_ID)[0];
    render(
      <WeeklySheet
        page={page}
        weekStart="2026-09-28"
        branchName="Buiucani"
        kindergarten={null}
        options={DEFAULT_OPTIONS}
      />,
    );
    expect(screen.getByText('ALERGIE')).toBeInTheDocument();
    expect(screen.getByText('MEDICAL')).toBeInTheDocument();
    expect(screen.queryByText(/Maria Ana|Ion Bogdan|Vasile Cristi/)).not.toBeInTheDocument();
  });
});
