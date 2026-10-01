import type { Meta, StoryObj } from '@storybook/react-vite';
import { Legend } from './Legend';

const meta: Meta<typeof Legend> = {
  title: 'Componente/Legend',
  component: Legend,
  parameters: { design: 'DS Date si grafice.dc.html §28e — explicația culorilor unui grafic' },
  args: {
    items: [
      { tone: 'mint', label: 'Cash 12 450 lei' },
      { tone: 'orange', label: 'Card 8 200 lei' },
      { tone: 'yellow', label: 'Transfer 3 100 lei' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Legend>;

export const Default: Story = {};
