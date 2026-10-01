import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormGrid } from './FormGrid';

const meta: Meta<typeof FormGrid> = {
  title: 'Formular/FormGrid',
  component: FormGrid,
  parameters: { design: 'DS-IMPLEMENTARE.md §3' },
  args: {
    columns: 2,
    children: (
      <>
        <div>Câmp 1</div>
        <div>Câmp 2</div>
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof FormGrid>;

export const Default: Story = {};

export const OneColumn: Story = { args: { columns: 1 } };
