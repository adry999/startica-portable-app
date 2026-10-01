import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

const meta: Meta<typeof ConfirmDeleteDialog> = {
  title: 'Tipare de pagină/ConfirmDeleteDialog',
  component: ConfirmDeleteDialog,
  parameters: { design: '13-formulare.md §Ștergere definitivă · vizual în Formulare.dc.html#15d' },
  args: {
    open: true,
    title: 'Șterge copilul definitiv?',
    description: 'Datele lui nu mai pot fi recuperate, inclusiv achitările și vizitele înregistrate.',
    onConfirm: fn(),
    onCancel: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ConfirmDeleteDialog>;

export const Default: Story = {};

export const EtichetaPersonalizata: Story = {
  args: { confirmLabel: 'Șterge 3 copii' },
};
