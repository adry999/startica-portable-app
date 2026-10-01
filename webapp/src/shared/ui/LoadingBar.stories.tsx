import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingBar } from './LoadingBar';

const meta: Meta<typeof LoadingBar> = {
  title: 'Componente/LoadingBar',
  component: LoadingBar,
  parameters: { design: 'Incarcare.dc.html#21a — bară + rândul cu pasul curent/procent (Pornire, StartupScreen.tsx)' },
  args: { percent: 64, stepLabel: 'Citesc baza de date…' },
};
export default meta;

type Story = StoryObj<typeof LoadingBar>;

export const Default: Story = {};

export const Complete: Story = { args: { percent: 100, stepLabel: 'Gata' } };
