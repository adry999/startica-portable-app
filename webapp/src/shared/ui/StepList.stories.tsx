import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepList } from './StepList';

const meta: Meta<typeof StepList> = {
  title: 'Componente/StepList',
  component: StepList,
  parameters: { design: 'Incarcare.dc.html#21a — lista pașilor cu bulină și durată (Pornire, StartupScreen.tsx)' },
  args: {
    steps: [
      { key: 'server', label: 'Pornesc serverul local', status: 'done', duration: '0,4 s' },
      { key: 'database', label: 'Citesc baza de date', status: 'current' },
      { key: 'dashboard', label: 'Pregătesc Dashboard-ul', status: 'pending' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof StepList>;

export const Default: Story = {};
