import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TaskRow } from './TaskRow';

const meta: Meta<typeof TaskRow> = {
  title: 'Date și grafice/TaskRow',
  component: TaskRow,
  parameters: { design: 'COMPONENTE.md §0i, 34k — rând de bifat într-o listă' },
  args: { label: 'Trimite notificare părinți', done: false, meta: 'Scadent azi', onToggle: fn() },
};
export default meta;

type Story = StoryObj<typeof TaskRow>;

export const Default: Story = {};

export const Done: Story = { args: { done: true, meta: undefined } };
