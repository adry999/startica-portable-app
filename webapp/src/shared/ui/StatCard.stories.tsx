import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StatCard } from './ProfileLayout';

const meta: Meta<typeof StatCard> = {
  title: 'Date și grafice/StatCard',
  component: StatCard,
  parameters: { design: '27-componente-comune.md #4 — mini-card de statistică din dreapta unei fișe' },
  args: { label: 'Sold', value: '0 lei', tone: 'mint', sub: 'La zi' },
};
export default meta;

type Story = StoryObj<typeof StatCard>;

export const Default: Story = {};

export const CuLink: Story = {
  args: {
    label: 'Salariu',
    value: '•••••',
    tone: undefined,
    sub: undefined,
    link: { label: 'Vezi cu PIN →', onClick: fn() },
  },
};
