import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Componente/Slider',
  component: Slider,
  parameters: { design: 'DS Diverse.dc.html §32g — mărimea interfeței' },
  args: { value: 50, onChange: fn(), ariaLabel: 'Mărime' },
};
export default meta;

type Story = StoryObj<typeof Slider>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true, ariaLabel: 'Mărime dezactivată' } };
