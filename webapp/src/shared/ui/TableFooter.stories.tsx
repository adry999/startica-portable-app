import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Pagination } from './Pagination';
import { TableFooter } from './TableFooter';

const meta: Meta<typeof TableFooter> = {
  title: 'Tabel și filtre/TableFooter',
  component: TableFooter,
  parameters: { design: 'Chrome de tabel — subsol cu total și paginare' },
  args: {
    summary: '24 de rezultate',
    pagination: <Pagination ariaLabel="Pagini" page={1} totalPages={3} onPageChange={fn()} />,
  },
};
export default meta;

type Story = StoryObj<typeof TableFooter>;

export const Default: Story = {};

export const WithoutPagination: Story = { args: { pagination: undefined } };
