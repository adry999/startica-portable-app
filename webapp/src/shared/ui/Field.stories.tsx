import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Field } from './Field';
import { TextInput } from './TextInput';

const meta: Meta<typeof Field> = {
  title: 'Formular/Field',
  component: Field,
  parameters: { design: 'COMPONENTE.md §0/25a' },
  args: {
    label: 'Nume',
    htmlFor: 'ds-field-nume',
    hint: 'Cum apare în listă',
    children: <TextInput id="ds-field-nume" value="" onChange={fn()} ariaDescribedBy="ds-field-nume-desc" />,
  },
};
export default meta;

type Story = StoryObj<typeof Field>;

export const Default: Story = {};

export const Optional: Story = {
  args: {
    label: 'Poreclă',
    htmlFor: 'ds-field-porecla',
    hint: undefined,
    optional: true,
    children: <TextInput id="ds-field-porecla" value="" onChange={fn()} />,
  },
};

export const Error: Story = {
  args: {
    label: 'Telefon',
    htmlFor: 'ds-field-telefon',
    hint: undefined,
    error: 'Telefonul nu e valid',
    children: (
      <TextInput id="ds-field-telefon" value="078" onChange={fn()} invalid ariaDescribedBy="ds-field-telefon-desc" />
    ),
  },
};
