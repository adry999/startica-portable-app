import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { InlineEdit } from './InlineEdit';

const meta: Meta<typeof InlineEdit> = {
  title: 'Formular/InlineEdit',
  component: InlineEdit,
  parameters: { design: 'COMPONENTE.md §0i/34d' },
  args: { ariaLabel: 'Nume', value: 'Ionescu Maria', onSave: fn() },
};
export default meta;

type Story = StoryObj<typeof InlineEdit>;

export const Default: Story = {};

export const Empty: Story = { args: { value: '', ariaLabel: 'Poreclă', placeholder: 'Fără poreclă' } };

export const Disabled: Story = { args: { disabled: true } };
