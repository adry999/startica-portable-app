import type { Meta, StoryObj } from '@storybook/react-vite';
import { Notice } from './Notice';

const meta: Meta<typeof Notice> = {
  title: 'Componente/Notice',
  component: Notice,
  parameters: { design: 'DS Componente.dc.html §28c — info/notă/eroare/gata' },
  args: { tone: 'info', children: 'Informație obișnuită.' },
};
export default meta;

type Story = StoryObj<typeof Notice>;

export const Default: Story = {};

export const Note: Story = { args: { tone: 'note', children: 'O notă de atenție.' } };

export const Error: Story = { args: { tone: 'error', children: 'A apărut o eroare.' } };

export const Done: Story = { args: { tone: 'done', children: 'Totul e la zi.' } };
