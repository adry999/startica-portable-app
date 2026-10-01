import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TonePicker } from './TonePicker';
import { SERVICE_TONES } from '@domain/record-schema.mjs';

const meta: Meta<typeof TonePicker> = {
  title: 'Componente/TonePicker',
  component: TonePicker,
  parameters: { design: 'Administrare.dc.html#10d · Grupe.dc.html#4c' },
  args: { ariaLabel: 'Culoare', tones: SERVICE_TONES, value: SERVICE_TONES[0], onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof TonePicker>;

export const Default: Story = {};
