import type { Meta, StoryObj } from '@storybook/react-vite';
import { PersonCell } from './PersonCell';

const meta: Meta<typeof PersonCell> = {
  title: 'Componente/PersonCell',
  component: PersonCell,
  parameters: { design: '27-componente-comune.md #1 — avatar+nume+sub unic (Copii, Personal, Candidați)' },
  args: { name: 'Coceva Alisa', sub: 'Contract 214', tone: 'orange' },
};
export default meta;

type Story = StoryObj<typeof PersonCell>;

export const Default: Story = {};

export const Large: Story = { args: { size: 'lg' } };

export const FaraSubtext: Story = { args: { sub: undefined } };
