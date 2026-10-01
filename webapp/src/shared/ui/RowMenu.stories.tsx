import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RowMenu } from './RowMenu';

const meta: Meta<typeof RowMenu> = {
  title: 'Tabel și filtre/RowMenu',
  component: RowMenu,
  parameters: { design: '02-copii-lista.md (meniul ⋯) · vizual în Copii.dc.html#2a' },
  args: {
    items: [
      { label: 'Editează', onClick: fn() },
      { label: 'Arhivează', onClick: fn() },
      { label: 'Șterge definitiv', onClick: fn(), danger: true },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof RowMenu>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    items: [
      { label: 'Editează', onClick: fn() },
      { label: 'Indisponibil', onClick: fn(), disabled: true, title: 'Doar administratorul poate' },
    ],
  },
};

export const CuDeclansatorText: Story = {
  args: { trigger: 'Mută în grupă', ariaLabel: 'Mută în grupă' },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByLabelText('Mai multe acțiuni');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
  },
};
