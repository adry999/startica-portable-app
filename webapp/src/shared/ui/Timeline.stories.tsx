import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timeline } from './Timeline';

const meta: Meta<typeof Timeline> = {
  title: 'Date și grafice/Timeline',
  component: Timeline,
  parameters: { design: 'COMPONENTE.md §0f, 31e — istoric cronologic (fișa angajatului)' },
  args: {
    entries: [
      {
        key: 't1',
        timestamp: '12 septembrie 2026, 14:30',
        title: 'Angajare',
        description: 'Contract semnat pe perioadă nedeterminată.',
      },
      {
        key: 't2',
        timestamp: '1 octombrie 2026, 09:00',
        title: 'Promovare',
        description: 'Educator principal, Grupa Delfin.',
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Timeline>;

export const Default: Story = {};
