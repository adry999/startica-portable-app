import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { UndoHistory } from './UndoHistory';

const meta: Meta<typeof UndoHistory> = {
  title: 'Componente/UndoHistory',
  component: UndoHistory,
  parameters: {
    design:
      'COMPONENTE.md §0f/28f · Prezența Ziua, Prezența Luna, Pontaj — stiva vine din useUndoStack (@shared/state)',
  },
  args: {
    history: [
      { id: '2', label: 'Ana Popescu: Prezent → Absent', time: '09:15' },
      { id: '1', label: 'Bogdan Rusu: Nemarcat → Prezent', time: '09:10' },
    ],
    canUndo: true,
    onUndoLast: fn(),
    onUndoUntil: fn(),
    onUndoAll: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof UndoHistory>;

export const Default: Story = {};

export const FaraIstoric: Story = { args: { history: [], canUndo: false } };
