import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { GroupFormDrawer } from './GroupFormDrawer';
import type { GroupCardView, UnassignedChild } from './useGroups';

const baseProps: Pick<
  React.ComponentProps<typeof GroupFormDrawer>,
  'groups' | 'unassignedChildren' | 'staff' | 'roleName' | 'leaves'
> = { groups: [], unassignedChildren: [], staff: [], roleName: () => '', leaves: [] };

function renderDrawer(props: Partial<React.ComponentProps<typeof GroupFormDrawer>> = {}) {
  return render(
    <GroupFormDrawer
      open
      {...baseProps}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe('GroupFormDrawer', () => {
  it('nu randează nimic când e închis', () => {
    render(<GroupFormDrawer open={false} {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arată câmpurile, previzualizarea și butonul de creare când e deschis, cu capacitatea implicită 14', () => {
    renderDrawer();
    expect(screen.getByLabelText('Nume grupă')).toBeInTheDocument();
    expect(screen.getByLabelText('Capacitate')).toHaveValue(14);
    expect(screen.getByRole('button', { name: 'Creează grupa' })).toBeInTheDocument();
    // Titlul drawer-ului + numele implicit din previzualizarea GroupTile.
    expect(screen.getAllByText('Grupă nouă')).toHaveLength(2);
    expect(screen.getByText('Goală')).toBeInTheDocument(); // pastila stării în previzualizare
  });

  it('butonul „Creează grupa” e dezactivat până se completează numele', async () => {
    renderDrawer();
    expect(screen.getByRole('button', { name: 'Creează grupa' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    expect(screen.getByRole('button', { name: 'Creează grupa' })).toBeEnabled();
  });

  it('trimite numele, capacitatea și tonul implicit la click pe Creează grupa', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDrawer({ onSubmit });

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.clear(screen.getByLabelText('Capacitate'));
    await userEvent.type(screen.getByLabelText('Capacitate'), '6');
    await userEvent.click(screen.getByRole('button', { name: 'Creează grupa' }));

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '6', 'yellow', '', '', []);
  });

  it('alegerea unei culori trimite tonul ales, nu implicitul', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDrawer({ onSubmit });

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.click(screen.getByLabelText('Culoare roz'));
    await userEvent.click(screen.getByRole('button', { name: 'Creează grupa' }));

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '14', 'pink', '', '', []);
  });

  it('sare peste tonurile deja folosite de alte grupe la alegerea implicită', () => {
    const groups = [
      { id: 'g1', tone: 'yellow' } as unknown as GroupCardView,
      { id: 'g2', tone: 'pink' } as unknown as GroupCardView,
    ];
    renderDrawer({ groups });
    expect(screen.getByLabelText('Culoare turcoaz')).toHaveAttribute('aria-pressed', 'true');
  });

  it('trimite formularul la submit (echivalent cu Enter într-un câmp)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderDrawer({ onSubmit });

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '14', 'yellow', '', '', []);
  });

  it('apelează onSubmit o singură dată la dublu-click rapid pe Creează grupa', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    renderDrawer({ onSubmit });

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    const saveButton = screen.getByRole('button', { name: 'Creează grupa' });

    await userEvent.click(saveButton);
    await userEvent.click(saveButton);
    resolveSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('pornește cu câmpuri goale la redeschidere după închidere', async () => {
    const { rerender } = render(<GroupFormDrawer open {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');

    rerender(<GroupFormDrawer open={false} {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);
    rerender(<GroupFormDrawer open {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Nume grupă')).toHaveValue('');
    expect(screen.getByLabelText('Capacitate')).toHaveValue(14);
  });

  it('formularul devine „nesalvat” după prima modificare și dispare la închidere (13b)', async () => {
    const { rerender } = render(
      <GroupFormDrawer open {...baseProps} onSubmit={vi.fn().mockResolvedValue(undefined)} onClose={vi.fn()} />,
    );

    expect(readDirtyForms()).toEqual([]);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o grupă');
    await expect(dirtyForm.save()).resolves.toBe(true);

    rerender(<GroupFormDrawer open={false} {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(readDirtyForms()).toEqual([]);
  });

  it('arată câți copii fără grupă se potrivesc cu intervalul de vârstă tastat', async () => {
    const unassignedChildren: UnassignedChild[] = [
      { id: 'c1', name: 'Ana', ageLabel: '3 ani', birthDate: '2022-01-01' },
      { id: 'c2', name: 'Bogdan', ageLabel: '6 ani', birthDate: '2019-01-01' },
    ];
    renderDrawer({ unassignedChildren });

    expect(screen.getByText(/2 copii fără grupă · îi poți adăuga după salvare\./)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Vârstă minimă (ani)'), '5');
    expect(await screen.findByText(/1 copil fără grupă are/)).toBeInTheDocument();
  });

  it('echipa aleasă din GroupTeamPicker (§5c) e trimisă odată cu „Creează grupa”', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const staff = [
      {
        id: 'STF-1',
        name: 'Ana Popescu',
        roleId: 'ROL-1',
        branchIds: ['bu'],
        phone: '',
        since: '2020-01-01',
        notes: [],
      },
    ];
    renderDrawer({ onSubmit, staff });

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.click(screen.getByRole('button', { name: '+ Alege' }));
    await userEvent.click(screen.getByRole('button', { name: /Ana Popescu/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Creează grupa' }));

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '14', 'yellow', '', '', [
      { staffId: 'STF-1', role: 'principal' },
    ]);
  });
});
