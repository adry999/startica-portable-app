import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from './Button';
import { Dialog } from './Dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Tipare de pagină/Dialog',
  component: Dialog,
  parameters: { design: 'DS Componente.dc.html §28g — panou modal centrat, scurt' },
  args: {
    open: true,
    title: 'Trimite rezumatul acum?',
    onClose: fn(),
    footer: <Button onClick={fn()}>Trimite</Button>,
    children: <p>Conținut scurt — doar demonstrativ, fără date reale.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {};
