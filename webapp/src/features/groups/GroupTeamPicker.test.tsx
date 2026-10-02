import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupTeamPicker } from './GroupTeamPicker';
import type { Staff } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';

const staff: Staff[] = [
  { id: 'STF-1', name: 'Ana Popescu', roleId: 'ROL-EDU', branchIds: ['bu'], phone: '', since: '2020-01-01', notes: [] },
  {
    id: 'STF-2',
    name: 'Bogdan Rusu',
    roleId: 'ROL-ASIST',
    branchIds: ['bu'],
    phone: '',
    since: '2020-01-01',
    notes: [],
  },
  {
    id: 'STF-3',
    name: 'Carmen Ionescu',
    roleId: 'ROL-ASIST',
    branchIds: ['bu'],
    phone: '',
    since: '2020-01-01',
    notes: [],
  },
];

const roleName = (roleId: string) => (roleId === 'ROL-EDU' ? 'Educator' : 'Asistent educator');

function renderPicker(overrides: Partial<React.ComponentProps<typeof GroupTeamPicker>> = {}) {
  const onChange = vi.fn();
  const team: GroupTeamMember[] = overrides.team ?? [];
  const utils = render(
    <GroupTeamPicker
      currentGroupId="GRP-1"
      team={team}
      onChange={onChange}
      staff={staff}
      roleName={roleName}
      allGroups={[{ id: 'GRP-1', name: 'Fluturași', team }]}
      leaves={[]}
      showDays
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

describe('GroupTeamPicker', () => {
  it('arată cele trei blocuri de rol cu textele de gol corecte', () => {
    renderPicker();
    expect(screen.getByText('Fără educator principal')).toBeInTheDocument();
    expect(screen.getAllByText('Nimeni')).toHaveLength(2);
  });

  it('adaugă un principal din panoul de căutare', async () => {
    const { onChange } = renderPicker();

    await userEvent.click(screen.getByRole('button', { name: '+ Alege' }));
    await userEvent.click(screen.getByRole('button', { name: /Ana Popescu/ }));

    expect(onChange).toHaveBeenCalledWith([{ staffId: 'STF-1', role: 'principal' }]);
  });

  it('„Schimbă” înlocuiește principalul existent, fără eroare de „are deja un principal”', async () => {
    const team: GroupTeamMember[] = [{ staffId: 'STF-1', role: 'principal' }];
    const { onChange } = renderPicker({ team });

    expect(screen.getByRole('button', { name: 'Schimbă' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Schimbă' }));
    await userEvent.click(screen.getByRole('button', { name: /Bogdan Rusu/ }));

    expect(onChange).toHaveBeenCalledWith([{ staffId: 'STF-2', role: 'principal' }]);
  });

  it('arată „unde lucrează deja” pentru fiecare candidat din căutare', async () => {
    renderPicker({
      allGroups: [
        { id: 'GRP-1', name: 'Fluturași', team: [] },
        { id: 'GRP-2', name: 'Ursuleți', team: [{ staffId: 'STF-2', role: 'principal' }] },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: '+ Asistent' }));

    const bogdanRow = screen.getByRole('button', { name: /Bogdan Rusu/ });
    expect(within(bogdanRow).getByText('Ursuleți · principal')).toBeInTheDocument();
    const anaRow = screen.getByRole('button', { name: /Ana Popescu/ });
    expect(within(anaRow).getByText('Liberă')).toBeInTheDocument();
  });

  it('scoate un membru din echipă', async () => {
    const team: GroupTeamMember[] = [{ staffId: 'STF-2', role: 'asistent' }];
    const { onChange } = renderPicker({ team });

    await userEvent.click(screen.getByRole('button', { name: 'Scoate Bogdan Rusu din echipă' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('comută o zi pentru un membru în modul cu zile (4a)', async () => {
    const team: GroupTeamMember[] = [{ staffId: 'STF-2', role: 'asistent' }];
    const { onChange } = renderPicker({ team, showDays: true });

    await userEvent.click(screen.getByRole('button', { name: 'L' }));

    expect(onChange).toHaveBeenCalledWith([{ staffId: 'STF-2', role: 'asistent', days: [1] }]);
  });

  it('nu arată rândul de zile în 4c (showDays=false)', () => {
    const team: GroupTeamMember[] = [{ staffId: 'STF-2', role: 'asistent' }];
    renderPicker({ team, showDays: false });

    expect(screen.queryByRole('button', { name: 'L' })).not.toBeInTheDocument();
  });
});
