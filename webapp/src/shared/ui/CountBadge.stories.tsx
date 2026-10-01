import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountBadge } from './CountBadge';

const meta: Meta<typeof CountBadge> = {
  title: 'Componente/CountBadge',
  component: CountBadge,
  parameters: { design: 'DS Componente.dc.html §28b — roșu = acțiune, neutru = informativ' },
  args: { count: 3, tone: 'action' },
};
export default meta;

type Story = StoryObj<typeof CountBadge>;

export const Default: Story = {};

export const Informative: Story = { args: { count: 12, tone: 'informative' } };

export const Max: Story = { args: { count: 140, max: 99, tone: 'action' } };
