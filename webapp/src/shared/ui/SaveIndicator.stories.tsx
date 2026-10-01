import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SaveIndicator } from './SaveIndicator';

const meta: Meta<typeof SaveIndicator> = {
  title: 'Componente/SaveIndicator',
  component: SaveIndicator,
  parameters: { design: 'COMPONENTE.md §0f/28f · Prezența, Pontaj, Bazin (marcaj)' },
  args: { saving: false, saveError: '', savedAt: '2026-09-27T08:12:00Z', unsavedCount: 0, onRetry: fn() },
};
export default meta;

type Story = StoryObj<typeof SaveIndicator>;

export const Default: Story = {};

export const SeSalveaza: Story = { args: { saving: true } };

export const NesalvatCuReincercare: Story = {
  args: { saving: false, saveError: 'rețea', unsavedCount: 3, savedAt: '' },
};
