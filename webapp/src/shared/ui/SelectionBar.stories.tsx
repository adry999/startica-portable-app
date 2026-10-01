import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SelectionBar } from './SelectionBar';

const meta: Meta<typeof SelectionBar> = {
  title: 'Tabel și filtre/SelectionBar',
  component: SelectionBar,
  parameters: { design: '02-copii-lista.md (bara „N selectați") · vizual în Copii.dc.html#2a' },
  args: {
    label: '3 selectați',
    actions: [
      { label: 'Mută în grupă', onClick: fn() },
      { label: 'Exportă', onClick: fn() },
    ],
    onCancel: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof SelectionBar>;

export const Default: Story = {};

export const Floating: Story = { args: { floating: true } };

export const CuDanger: Story = {
  args: { danger: { label: 'Șterge definitiv', onClick: fn() } },
};

export const Disabled: Story = {
  args: { actions: [{ label: 'Mută în grupă', onClick: fn(), disabled: true }] },
};
