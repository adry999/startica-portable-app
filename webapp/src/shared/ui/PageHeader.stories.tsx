import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Componente/PageHeader',
  component: PageHeader,
  parameters: { design: 'DS Componente.dc.html §28d — antet de ecran' },
  args: {
    title: 'Copii',
    secondaryActions: <Button variant="outline">Exportă</Button>,
    primaryAction: <Button variant="primary">+ Copil nou</Button>,
  },
};
export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};

export const Minimal: Story = { args: { secondaryActions: undefined, primaryAction: undefined } };
