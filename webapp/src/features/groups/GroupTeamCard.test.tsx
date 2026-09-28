import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { GroupTeamCard } from './GroupTeamCard';
import type { Staff } from '@shared/personal/personal.types';
import type { Group, GroupTeamMember } from '@contracts/record-types.mjs';

const staff: Staff[] = [
  { id: 'STF-1', name: 'Ana Popescu', roleId: 'ROL-1', branchIds: ['bu'], phone: '', since: '2020-01-01', notes: [] },
  { id: 'STF-2', name: 'Bogdan Rusu', roleId: 'ROL-2', branchIds: ['bu'], phone: '', since: '2020-01-01', notes: [] },
  {
    id: 'STF-3',
    name: 'Carmen Ionescu',
    roleId: 'ROL-2',
    branchIds: ['bu'],
    phone: '',
    since: '2020-01-01',
    notes: [],
  },
];

const team: GroupTeamMember[] = [
  { staffId: 'STF-1', role: 'principal' },
  { staffId: 'STF-2', role: 'asistent', days: [1, 2] },
];

const group: Group = { id: 'GRP-1', name: 'Fluturași', capacity: 10, team };

describe('GroupTeamCard', () => {
  it('echipa grupei arată principalul, asistenții și înlocuitorii cu zilele', () => {
    render(
      <ToastProvider>
        <GroupTeamCard group={group} staff={staff} onSave={async () => {}} />
      </ToastProvider>,
    );

    const list = screen.getByRole('list');
    expect(within(list).getByText('Ana Popescu')).toBeInTheDocument();
    expect(within(list).getByText('principal')).toBeInTheDocument();
    expect(within(list).getByText('Bogdan Rusu')).toBeInTheDocument();
    expect(within(list).getByText('asistent')).toBeInTheDocument();
    expect(within(list).queryByText('Carmen Ionescu')).not.toBeInTheDocument();
  });

  it('salvează echipa actualizată la apăsarea butonului', async () => {
    const onSave = vi.fn(async () => {});
    render(
      <ToastProvider>
        <GroupTeamCard group={group} staff={staff} onSave={onSave} />
      </ToastProvider>,
    );

    const staffSelect = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(staffSelect, 'STF-3');
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvează echipa' }));

    expect(onSave).toHaveBeenCalledWith([
      { staffId: 'STF-1', role: 'principal' },
      { staffId: 'STF-2', role: 'asistent', days: [1, 2] },
      { staffId: 'STF-3', role: 'asistent' },
    ]);
  });
});
