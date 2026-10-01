import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from './Badge';
import { SettingsList, type SettingsListItem } from './SettingsList';

interface DemoSettingsItem extends SettingsListItem {
  name: string;
  count: number;
  hidden: boolean;
}

const ITEMS: DemoSettingsItem[] = [
  { id: 'gradinita', name: 'Grădiniță', count: 12, hidden: false },
  { id: 'bazin', name: 'Bazin', count: 4, hidden: false },
  { id: 'excursie', name: 'Excursie', count: 0, hidden: true },
];

const meta: Meta<typeof SettingsList<DemoSettingsItem>> = {
  title: 'Tabel și filtre/SettingsList',
  component: SettingsList,
  parameters: { design: 'COMPONENTE.md §2 · Backup și setări → Servicii (backup/ServicesSettings.tsx)' },
  args: {
    items: ITEMS,
    ariaLabel: 'Servicii',
    onReorder: fn(),
    renderName: item => item.name,
    renderCount: item => `${item.count} ${item.count === 1 ? 'achitare' : 'achitări'}`,
    renderStatus: item => <Badge tone={item.hidden ? 'neutral' : 'mint'}>{item.hidden ? 'Ascuns' : 'Activ'}</Badge>,
    renderActions: () => <button type="button">Editează</button>,
  },
};
export default meta;

type Story = StoryObj<typeof SettingsList<DemoSettingsItem>>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    items: [],
    ariaLabel: 'Servicii (gol)',
    onReorder: undefined,
    renderCount: undefined,
    renderStatus: undefined,
    renderActions: undefined,
    emptyMessage: 'Niciun element încă.',
  },
};
