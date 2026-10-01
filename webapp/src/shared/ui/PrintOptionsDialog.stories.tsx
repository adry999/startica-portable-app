import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PrintOptionsDialog } from './PrintOptionsDialog';

const meta: Meta<typeof PrintOptionsDialog> = {
  title: 'Tipare de pagină/PrintOptionsDialog',
  component: PrintOptionsDialog,
  parameters: { design: 'COMPONENTE.md §0i — dialog de opțiuni înainte de printare' },
  args: {
    open: true,
    onClose: fn(),
    onPrint: fn(),
    children: <p>Conținutul formularului de opțiuni — doar demonstrativ, fără date reale.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof PrintOptionsDialog>;

export const Default: Story = {};
