import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ErrorState } from './ErrorState';

const meta: Meta<typeof ErrorState> = {
  title: 'Componente/ErrorState',
  component: ErrorState,
  parameters: { design: 'DS Incarcare si stari.dc.html §29g — eroare de secțiune, cu reîncercare' },
  args: {
    description: 'Verifică legătura și încearcă din nou.',
    technicalDetail: 'fetch failed: ECONNREFUSED',
    onRetry: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {};

export const FaraReincercare: Story = {
  args: { onRetry: undefined },
};
