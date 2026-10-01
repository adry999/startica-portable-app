import type { Meta, StoryObj } from '@storybook/react-vite';
import { SmsPreview } from './SmsPreview';

const meta: Meta<typeof SmsPreview> = {
  title: 'Componente/SmsPreview',
  component: SmsPreview,
  parameters: { design: 'COMPONENTE.md §0g — previzualizare SMS' },
  args: {
    senderName: 'Grădinița Pitici',
    message: 'Bună ziua! Vă reamintim că mâine este ziua de achitare a taxei lunare.',
  },
};
export default meta;

type Story = StoryObj<typeof SmsPreview>;

export const Default: Story = {};
