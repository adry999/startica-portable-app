import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MissingFieldsBanner } from './MissingFieldsBanner';

const meta: Meta<typeof MissingFieldsBanner> = {
  title: 'Componente/MissingFieldsBanner',
  component: MissingFieldsBanner,
  parameters: { design: 'Feedback 01-10.dc.html#41a — bandă „Lipsesc N date” sub antetul fișei' },
  args: {
    fields: [
      { key: 'phone', label: 'Telefon părinte 1', required: true },
      { key: 'parent2', label: 'Părinte 2', required: false },
      { key: 'idnp', label: 'IDNP', required: false },
    ],
    onFieldClick: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof MissingFieldsBanner>;

/** Cel puțin un obligatoriu lipsă → roz. */
export const Required: Story = {};

/** Doar recomandate lipsă → galben. */
export const RecommendedOnly: Story = {
  args: {
    fields: [
      { key: 'parent2', label: 'Părinte 2', required: false },
      { key: 'idnp', label: 'IDNP', required: false },
    ],
  },
};

export const SingleField: Story = {
  args: { fields: [{ key: 'idnp', label: 'IDNP', required: false }] },
};

/** Fișă completă — banda nu randează nimic. */
export const Empty: Story = {
  args: { fields: [] },
};
