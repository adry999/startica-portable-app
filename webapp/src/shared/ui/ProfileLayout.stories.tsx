import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ProfileLayout, ProfileSection, StatCard } from './ProfileLayout';

const meta: Meta<typeof ProfileLayout> = {
  title: 'Tipare de pagină/ProfileLayout',
  component: ProfileLayout,
  parameters: {
    design: '27-componente-comune.md #4 — bandă + grilă stânga/dreapta (Fișa copilului, Fișa angajatului)',
  },
  args: {
    back: { label: 'Copii', onClick: fn() },
    header: {
      name: 'Coceva Alisa',
      tone: 'orange',
      meta: '5a 2l · Contract 214',
      badges: [
        { label: 'Activ', tone: 'mint' },
        { label: 'Fluturași', tone: 'orange' },
      ],
      actions: <button type="button">Editează fișa</button>,
    },
    left: <ProfileSection title="Părinți">Ana Coceva · 069 000 000</ProfileSection>,
    stats: [<StatCard key="sold" label="Sold" value="0 lei" tone="mint" sub="La zi" />],
    right: <ProfileSection title="Istoric plăți">Fără achitări.</ProfileSection>,
  },
};
export default meta;

type Story = StoryObj<typeof ProfileLayout>;

export const Default: Story = {};

export const FaraStatisticiSiActiuni: Story = {
  args: {
    header: { name: 'Coceva Alisa', tone: 'orange', meta: '5a 2l · Contract 214' },
    stats: undefined,
  },
};
