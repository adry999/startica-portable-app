import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ListToolbar } from './ListToolbar';

const meta: Meta<typeof ListToolbar> = {
  title: 'Tabel și filtre/ListToolbar',
  component: ListToolbar,
  parameters: { design: '27-componente-comune.md #3 — căutare + acțiuni + contor, unic (Copii, Personal, Candidați)' },
  args: {
    search: { value: '', onChange: fn(), ariaLabel: 'Caută', placeholder: 'Caută după nume' },
    trailing: '8 persoane',
  },
};
export default meta;

type Story = StoryObj<typeof ListToolbar>;

export const Default: Story = {};

export const CuActiuni: Story = {
  args: { children: <button type="button">Funcții</button> },
};

export const CuTextDeCautare: Story = {
  args: { search: { value: 'Alisa', onChange: fn(), ariaLabel: 'Caută', placeholder: 'Caută după nume' } },
};
