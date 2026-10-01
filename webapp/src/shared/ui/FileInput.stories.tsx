import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FileInput } from './FileInput';

const meta: Meta<typeof FileInput> = {
  title: 'Formular/FileInput',
  component: FileInput,
  parameters: { design: 'COMPONENTE.md §0/25b · Administrare.dc.html#16a' },
  args: { ariaLabel: 'Logo grădiniță', accept: 'image/*', onSelect: fn(), placeholder: <span>G</span> },
};
export default meta;

type Story = StoryObj<typeof FileInput>;

export const Default: Story = {};

export const WithPreview: Story = {
  args: {
    value: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>',
    onClear: fn(),
  },
};

export const Disabled: Story = { args: { ariaLabel: 'Câmp dezactivat', disabled: true } };
