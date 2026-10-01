import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServiceBadge, serviceTone } from './ServiceBadge';

const meta: Meta<typeof ServiceBadge> = {
  title: 'Componente/ServiceBadge',
  component: ServiceBadge,
  parameters: { design: 'Administrare.dc.html#10d (Servicii) · Achitari.dc.html#5a — tonul vine din `service.tone`' },
  args: { service: { name: 'Grădiniță', tone: 'orange' } },
};
export default meta;

type Story = StoryObj<typeof ServiceBadge>;

export const Default: Story = {};

export const Bazin: Story = {
  args: { service: { name: 'Bazin', tone: serviceTone({ name: 'Bazin', tone: 'blue' }) } },
};
export const Excursie: Story = { args: { service: { name: 'Excursie', tone: 'purple' } } };
