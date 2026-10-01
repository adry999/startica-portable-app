import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from './Button';
import { Drawer } from './Drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Tipare de pagină/Drawer',
  component: Drawer,
  parameters: { design: '13-formulare.md (panou lateral, comun 15a/15b) · vizual în Formulare.dc.html#15a' },
  args: {
    open: true,
    title: 'Achitare nouă (exemplu)',
    onClose: fn(),
    footer: <Button onClick={fn()}>Salvează</Button>,
    children: <p>Conținutul formularului — doar demonstrativ, fără date reale.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof Drawer>;

export const Default: Story = {};
