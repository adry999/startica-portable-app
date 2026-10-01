import type { Meta, StoryObj } from '@storybook/react-vite';
import { Disclosure } from './Disclosure';

const meta: Meta<typeof Disclosure> = {
  title: 'Componente/Disclosure',
  component: Disclosure,
  parameters: { design: 'COMPONENTE.md §0f — secțiune pliabilă' },
  args: {
    title: 'Detalii suplimentare',
    defaultOpen: true,
    children: <p>Conținutul secțiunii pliabile.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof Disclosure>;

export const Default: Story = {};

export const Inchis: Story = { args: { defaultOpen: false } };
