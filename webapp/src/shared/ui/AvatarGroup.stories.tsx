import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarGroup } from './AvatarGroup';

const meta: Meta<typeof AvatarGroup> = {
  title: 'Componente/AvatarGroup',
  component: AvatarGroup,
  parameters: { design: 'COMPONENTE.md §0e — grup de avataruri suprapuse' },
  args: {
    items: [
      { name: 'Ionescu Maria' },
      { name: 'Popescu Andrei' },
      { name: 'Rusu Ana' },
      { name: 'Marin Elena' },
      { name: 'Coceva Alisa' },
    ],
    maxVisible: 3,
  },
};
export default meta;

type Story = StoryObj<typeof AvatarGroup>;

export const Default: Story = {};

export const AllVisible: Story = { args: { maxVisible: 5 } };
