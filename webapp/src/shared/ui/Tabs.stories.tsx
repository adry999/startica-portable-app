import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Tabs } from './Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Diverse/Tabs',
  component: Tabs,
  parameters: { design: 'DS Componente.dc.html §28d — navigare între subpagini (ex. Backup și setări)' },
  args: {
    ariaLabel: 'Filă Backup și setări',
    value: 'backup',
    onChange: fn(),
    options: [
      { value: 'backup', label: 'Backup' },
      { value: 'curs', label: 'Planuri și curs' },
      { value: 'branches', label: 'Filiale' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tab = canvas.getByRole('tab', { name: 'Planuri și curs' });
    await userEvent.hover(tab);
    await expect(tab).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const active = canvas.getByRole('tab', { name: 'Backup' });
    await expect(active).toHaveFocus();
  },
};
