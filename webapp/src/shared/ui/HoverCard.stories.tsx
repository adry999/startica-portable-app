import type { Meta, StoryObj } from '@storybook/react-vite';
import { HoverCard } from './HoverCard';

const meta: Meta<typeof HoverCard> = {
  title: 'Componente/HoverCard',
  component: HoverCard,
  parameters: { design: 'DS Componente 2.dc.html §34i — 400ms intrare' },
  args: {
    content: <div>Detalii suplimentare despre acest element.</div>,
    children: <button type="button">Treci cu mouse-ul</button>,
  },
};
export default meta;

type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };
