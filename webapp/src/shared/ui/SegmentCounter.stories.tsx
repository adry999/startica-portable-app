import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentCounter } from './SegmentCounter';

const meta: Meta<typeof SegmentCounter> = {
  title: 'Componente/SegmentCounter',
  component: SegmentCounter,
  parameters: { design: 'COMPONENTE.md §0g — contor de caractere/segmente SMS' },
  args: { text: 'Buna ziua! Va reamintim ca maine este ziua de achitare a taxei lunare.' },
};
export default meta;

type Story = StoryObj<typeof SegmentCounter>;

export const Default: Story = {};

export const MultipleSegments: Story = {
  args: {
    text: 'Bună ziua! Vă reamintim că restanța dumneavoastră pentru luna septembrie este de 1500 lei. Vă rugăm să achitați cât mai curând pentru a evita penalizări. Vă mulțumim pentru înțelegere!',
  },
};
