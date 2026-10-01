import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Tipare de pagină/ConfirmDialog',
  component: ConfirmDialog,
  parameters: { design: 'DS Componente.dc.html §28g — confirmare da/nu peste Dialog' },
  args: {
    open: true,
    title: 'Arhivezi categoria „Materiale”?',
    description: 'Cheltuielile existente rămân neschimbate.',
    confirmLabel: 'Arhivează',
    onConfirm: fn(),
    onCancel: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {};

export const ToneDanger: Story = {
  args: {
    title: 'Ștergi grupa „Fluturași”?',
    description: 'Acțiunea nu poate fi anulată.',
    confirmLabel: 'Șterge',
    tone: 'danger',
  },
};
