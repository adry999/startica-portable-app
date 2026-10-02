import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dot } from './Dot';

const meta: Meta<typeof Dot> = {
  title: 'Componente/Dot',
  component: Dot,
  parameters: { design: 'Personal.dc.html#23n (punctul de departament, Funcții/Funcția)' },
  args: { tone: 'yellow' },
};
export default meta;

type Story = StoryObj<typeof Dot>;

export const Default: Story = {};

export const Pink: Story = { args: { tone: 'pink' } };
export const Teal: Story = { args: { tone: 'teal' } };
export const Mint: Story = { args: { tone: 'mint' } };
export const Blue: Story = { args: { tone: 'blue' } };
export const Orange: Story = { args: { tone: 'orange' } };
export const Purple: Story = { args: { tone: 'purple' } };
export const Coral: Story = { args: { tone: 'coral' } };
