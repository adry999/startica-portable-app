import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TagInput } from './TagInput';

const meta: Meta<typeof TagInput> = {
  title: 'Formular/TagInput',
  component: TagInput,
  parameters: { design: 'DS Diverse.dc.html §32g' },
  args: {
    ariaLabel: 'Alergii',
    placeholder: 'Adaugă o alergie…',
    tags: ['Lactate', 'Nuci'],
    onChange: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof TagInput>;

export const Default: Story = {};

export const Empty: Story = { args: { tags: [] } };
