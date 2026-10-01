import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterPills, type FilterPillGroup } from './FilterPills';
import { groupTone } from './group-tone';
import { DEMO_GROUPS } from './stories.fixtures';

type PaymentFilterValue = 'toate' | 'achitat' | 'neachitat';

const groups: FilterPillGroup<string>[] = [
  {
    label: 'Grupă',
    value: 'toate',
    onChange: fn(),
    options: [
      { value: 'toate', label: 'Toate', tone: 'neutral' },
      ...DEMO_GROUPS.map(group => ({ value: group.id, label: group.name, tone: groupTone(group.id, DEMO_GROUPS) })),
    ],
  },
  {
    label: 'Plată',
    value: 'toate' satisfies PaymentFilterValue,
    onChange: fn(),
    options: [
      { value: 'toate', label: 'Toate', tone: 'neutral' },
      { value: 'achitat', label: 'Achitat', tone: 'mint' },
      { value: 'neachitat', label: 'Neachitat', tone: 'pink' },
    ],
  },
];

const meta: Meta<typeof FilterPills> = {
  title: 'Tabel și filtre/FilterPills',
  component: FilterPills,
  parameters: { design: '00-comun.md §B/§C · Copii.dc.html#2a' },
  args: { groups, trailing: `${DEMO_GROUPS.length} grupe` },
};
export default meta;

type Story = StoryObj<typeof FilterPills>;

export const Default: Story = {};
