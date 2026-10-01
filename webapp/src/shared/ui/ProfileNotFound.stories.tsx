import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ProfileNotFound } from './ProfileLayout';

const meta: Meta<typeof ProfileNotFound> = {
  title: 'Tipare de pagină/ProfileNotFound',
  component: ProfileNotFound,
  parameters: { design: '27-componente-comune.md #4 — fișa cerută nu a fost găsită' },
  args: { back: { label: 'Copii', onClick: fn() } },
};
export default meta;

type Story = StoryObj<typeof ProfileNotFound>;

export const Default: Story = {};
