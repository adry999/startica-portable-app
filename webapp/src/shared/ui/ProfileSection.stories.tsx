import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ProfileSection } from './ProfileLayout';

const meta: Meta<typeof ProfileSection> = {
  title: 'Tipare de pagină/ProfileSection',
  component: ProfileSection,
  parameters: { design: '27-componente-comune.md #4 — card cu titlu și, opțional, un link în dreapta' },
  args: { title: 'Note', children: 'Nicio notă încă.' },
};
export default meta;

type Story = StoryObj<typeof ProfileSection>;

export const Default: Story = {};

export const CuActiune: Story = {
  args: { action: { label: '+ Notă', onClick: fn() } },
};
