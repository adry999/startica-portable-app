import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Pagination } from './Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Tabel și filtre/Pagination',
  component: Pagination,
  parameters: { design: 'Chrome de tabel — navigare pagini' },
  args: { ariaLabel: 'Pagini', page: 2, totalPages: 5, onPageChange: fn() },
};
export default meta;

type Story = StoryObj<typeof Pagination>;

export const Default: Story = {};

export const FirstPage: Story = { args: { page: 1 } };

export const LastPage: Story = { args: { page: 5 } };

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole('button', { name: 'Pagina următoare' });
    await userEvent.hover(next);
    await expect(next).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const prev = canvas.getByRole('button', { name: 'Pagina anterioară' });
    await expect(prev).toHaveFocus();
  },
};
