import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

const meta: Meta<typeof UnsavedChangesDialog> = {
  title: 'Tipare de pagină/UnsavedChangesDialog',
  component: UnsavedChangesDialog,
  parameters: { design: 'DS Componente 2.dc.html §34g — 3 alegeri' },
  args: {
    open: true,
    formName: 'copilul nou',
    changedFields: ['nume', 'telefon'],
    onDiscard: fn(),
    onStay: fn(),
    onSaveAndContinue: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof UnsavedChangesDialog>;

export const Default: Story = {};

export const SeSalveaza: Story = { args: { saving: true } };
