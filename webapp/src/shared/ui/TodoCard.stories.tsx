import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TodoCard } from './TodoCard';

const meta: Meta<typeof TodoCard> = {
  title: 'Date și grafice/TodoCard',
  component: TodoCard,
  parameters: { design: 'COMPONENTE.md §0i, 34k — element de rezolvat, pe dashboard' },
  args: { title: 'Certificate medicale expirate', detail: '3 copii', onClick: fn() },
};
export default meta;

type Story = StoryObj<typeof TodoCard>;

export const Default: Story = {};

export const FaraDetail: Story = { args: { detail: undefined } };
