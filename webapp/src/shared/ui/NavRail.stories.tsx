import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { NavRail, type NavRailItem } from './NavRail';

const ITEMS: NavRailItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'menu', active: true, onClick: fn() },
  { key: 'copii', label: 'Copii', icon: 'search', onClick: fn() },
  { key: 'grupe', label: 'Grupe', icon: 'grip-vertical', onClick: fn() },
];

const meta: Meta<typeof NavRail> = {
  title: 'Aplicație/NavRail',
  component: NavRail,
  parameters: { design: '31g / DS-IMPLEMENTARE.md §8 — bara de navigație principală' },
  args: { items: ITEMS },
};
export default meta;

type Story = StoryObj<typeof NavRail>;

export const Default: Story = {};
