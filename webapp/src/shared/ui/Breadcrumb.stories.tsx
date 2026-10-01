import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Breadcrumb } from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Componente/Breadcrumb',
  component: Breadcrumb,
  parameters: { design: 'DS Componente.dc.html §28d — fir de ariadnă' },
  args: { items: [{ label: 'Copii', onClick: fn() }, { label: 'Ionescu Maria' }] },
};
export default meta;

type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {};

export const ThreeLevels: Story = {
  args: { items: [{ label: 'Personal', onClick: fn() }, { label: 'Rusu Ana', onClick: fn() }, { label: 'Concedii' }] },
};
