import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoteList } from './NoteList';

const meta: Meta<typeof NoteList> = {
  title: 'Date și grafice/NoteList',
  component: NoteList,
  parameters: { design: 'COMPONENTE.md §2 — note libere pe fișa copilului/angajatului' },
  args: {
    notes: [
      { key: 'n1', author: 'Educator Rusu Ana', date: '12 septembrie 2026', text: 'Alergie nouă confirmată — nuci.' },
      {
        key: 'n2',
        author: 'Admin',
        date: '1 septembrie 2026',
        text: 'Contract reînnoit pentru anul școlar curent.',
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof NoteList>;

export const Default: Story = {};
