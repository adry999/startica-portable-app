import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Kpi } from './Kpi';

const meta: Meta<typeof Kpi> = {
  title: 'Date și grafice/Kpi',
  component: Kpi,
  parameters: { design: 'DS Componente.dc.html §28c — KPI cu tone/size/emphasis/decorative' },
  args: { tone: 'orange', decorative: 'lg', size: 'lg', label: 'Încasări', value: '45 320 lei' },
};
export default meta;

type Story = StoryObj<typeof Kpi>;

export const Default: Story = {};

export const Loading: Story = {
  args: { tone: 'mint', decorative: false, size: 'sm', label: 'Cheltuieli', value: '—', state: 'loading' },
};

export const Refreshing: Story = {
  args: { tone: 'yellow', decorative: false, size: 'sm', label: 'Diferență', value: '12 100 lei', state: 'refreshing' },
};

export const Error: Story = {
  args: { tone: 'dashed', decorative: false, size: 'sm', label: 'Avansuri', value: '—', state: 'error', onRetry: fn() },
};

export const ActiveTone: Story = {
  args: { tone: 'white', decorative: false, size: 'sm', activeTone: 'orange', label: 'Cash · 4', value: '12 000 lei' },
};
