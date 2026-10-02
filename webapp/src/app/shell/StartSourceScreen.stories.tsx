import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StartSourceScreen } from './StartSourceScreen';

const meta: Meta<typeof StartSourceScreen> = {
  title: 'Aplicație/StartSourceScreen',
  component: StartSourceScreen,
  parameters: { design: 'Prima pornire.dc.html#46a — alegere: backup, sincronizare sau de la zero' },
  args: { onContinue: fn() },
};
export default meta;

type Story = StoryObj<typeof StartSourceScreen>;

export const Default: Story = {};
