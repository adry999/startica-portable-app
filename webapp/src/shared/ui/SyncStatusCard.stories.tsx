import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SyncStatusCard } from './SyncStatusCard';

const meta: Meta<typeof SyncStatusCard> = {
  title: 'Aplicație/SyncStatusCard',
  component: SyncStatusCard,
  parameters: { design: '32b — starea sincronizării din antet' },
  args: { state: 'synced', message: 'Sincronizat acum 2 minute' },
};
export default meta;

type Story = StoryObj<typeof SyncStatusCard>;

export const Default: Story = {};

export const Syncing: Story = { args: { state: 'syncing', message: 'Se sincronizează…' } };

export const ErrorState: Story = { args: { state: 'error', message: 'Eroare la sincronizare', onRetry: fn() } };

export const Offline: Story = { args: { state: 'offline', message: 'Offline' } };
