import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Pagination } from './Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'Tabel și filtre/Pagination',
  component: Pagination,
  parameters: { design: 'COMPONENTE.md §Pagination · 27a/38a' },
  args: {
    ariaLabel: 'Pagini',
    page: 2,
    totalPages: 13,
    totalRows: 312,
    pageSize: 25,
    onPageChange: fn(),
    onPageSizeChange: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof Pagination>;

export const Default: Story = {};

export const PuținePagini: Story = { args: { page: 1, totalPages: 7, totalRows: 175 } };

export const FirstPage: Story = { args: { page: 1 } };

export const LastPage: Story = { args: { page: 13, totalRows: 312 } };

export const OSingurăPagină: Story = { args: { page: 1, totalPages: 1, totalRows: 8 } };

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
    const select = canvas.getByRole('combobox', { name: 'Rânduri pe pagină' });
    await expect(select).toHaveFocus();
  },
};
