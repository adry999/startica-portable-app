import type { Meta, StoryObj } from '@storybook/react-vite';
import { InlineError } from './InlineError';

const meta: Meta<typeof InlineError> = {
  title: 'Componente/InlineError',
  component: InlineError,
  parameters: { design: 'DS Incarcare si stari.dc.html §29g — eroare lângă un câmp' },
  args: { message: 'Numărul de telefon nu e valid.' },
};
export default meta;

type Story = StoryObj<typeof InlineError>;

export const Default: Story = {};
