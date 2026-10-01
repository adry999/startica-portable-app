import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Board, type BoardColumn } from './Board';

const COLUMNS: BoardColumn[] = [
  {
    key: 'sosit',
    title: 'Sosit',
    cards: [
      { key: 'b1', label: 'Ionescu Maria' },
      { key: 'b2', label: 'Popescu Andrei' },
    ],
  },
  { key: 'in-curte', title: 'În curte', cards: [{ key: 'b3', label: 'Rusu Ana' }] },
  { key: 'plecat', title: 'Plecat', cards: [] },
  { key: 'mars', title: 'Grupa Mars', cards: [], disabledReason: 'Grupa e plină' },
];

const meta: Meta<typeof Board> = {
  title: 'Aplicație/Board',
  component: Board,
  parameters: { design: '31a — panou cu coloane trase (v1 simplificat, fără reordonare cu tastatura)' },
  args: { columns: COLUMNS, onMoveCard: fn() },
};
export default meta;

type Story = StoryObj<typeof Board>;

export const Default: Story = {};
