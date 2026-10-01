import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormSection } from './FormSection';

const meta: Meta<typeof FormSection> = {
  title: 'Formular/FormSection',
  component: FormSection,
  parameters: { design: 'DS-IMPLEMENTARE.md §3' },
  args: {
    title: 'Date de contact',
    description: 'Folosite pentru notificări SMS.',
    children: <p>Câmpurile formularului ar veni aici.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof FormSection>;

export const Default: Story = {};

export const WithoutDescription: Story = { args: { description: undefined } };
