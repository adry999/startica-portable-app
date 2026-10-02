import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { QuickPaySearch } from './QuickPaySearch';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

function child(overrides: Partial<Child> & { id: string; name: string }): Child {
  return {
    phone: '',
    phone2: '',
    parent: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [{ from: '2020-01', amount: 1000 }],
    attendanceDate: '2020-01-01',
    dueDay: 10,
    archived: false,
    ...overrides,
  } as Child;
}

const amedeia = child({ id: 'c1', name: 'Amedeia Hudic', phone: '+37369123456', groupId: 'g1' });
const tudor = child({ id: 'c2', name: 'Tudor Hudic', phone2: '+37369123456', groupId: 'g2' });

function recordsWith(children: Child[]): RecordsSnapshot {
  return {
    children,
    payments: [],
    expenses: [],
    groups: [
      { id: 'g1', name: 'Neptun' },
      { id: 'g2', name: 'Marte' },
    ],
    categories: [],
    visits: [],
  } as unknown as RecordsSnapshot;
}

describe('QuickPaySearch (44a)', () => {
  it('nu arată niciun meniu înainte de a scrie ceva', () => {
    render(<QuickPaySearch records={recordsWith([amedeia])} onSelect={() => {}} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('caută pe măsură ce scrii și arată rezultatul, cu fratele dedesubt', async () => {
    render(<QuickPaySearch records={recordsWith([amedeia, tudor])} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Încasare rapidă'), 'Amedeia');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Amedeia Hudic');
    expect(options[1]).toHaveTextContent('Tudor Hudic');
  });

  it('arată starea „fără rezultate” când nimic nu se potrivește', async () => {
    render(<QuickPaySearch records={recordsWith([amedeia])} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Încasare rapidă'), 'nimeni-din-lista');
    expect(screen.getByText('Fără rezultate')).toBeInTheDocument();
  });

  it('Enter pe rândul activ selectează copilul și golește căutarea', async () => {
    const onSelect = vi.fn();
    render(<QuickPaySearch records={recordsWith([amedeia])} onSelect={onSelect} />);
    const input = screen.getByLabelText('Încasare rapidă');
    await userEvent.type(input, 'Amedeia');
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('c1');
    expect(input).toHaveValue('');
  });

  it('clic pe un rând selectează copilul', async () => {
    const onSelect = vi.fn();
    render(<QuickPaySearch records={recordsWith([amedeia, tudor])} onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText('Încasare rapidă'), 'Amedeia');
    await userEvent.click(screen.getByText('Tudor Hudic'));

    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('săgețile mută rândul activ, Escape golește căutarea', async () => {
    render(<QuickPaySearch records={recordsWith([amedeia, tudor])} onSelect={() => {}} />);
    const input = screen.getByLabelText('Încasare rapidă');
    await userEvent.type(input, 'Hudic');

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('tasta „N" focusează căutarea din afara ei, dar nu când focusul e deja într-un câmp', async () => {
    render(
      <>
        <input aria-label="alt câmp" />
        <QuickPaySearch records={recordsWith([amedeia])} onSelect={() => {}} />
      </>,
    );
    const otherField = screen.getByLabelText('alt câmp');
    const quickPayInput = screen.getByLabelText('Încasare rapidă');

    // Focusul e pe document.body — tasta N trebuie să mute focusul pe căutare.
    await userEvent.keyboard('n');
    expect(quickPayInput).toHaveFocus();

    quickPayInput.blur();
    otherField.focus();
    await userEvent.keyboard('n');
    // „n" a fost scris în câmpul deja focusat, nu a mutat focusul.
    expect(otherField).toHaveFocus();
    expect(otherField).toHaveValue('n');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<QuickPaySearch records={recordsWith([amedeia])} onSelect={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
