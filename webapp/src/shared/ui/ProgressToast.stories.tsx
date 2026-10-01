import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ProgressToast } from './ProgressToast';

const meta: Meta<typeof ProgressToast> = {
  title: 'Componente/ProgressToast',
  component: ProgressToast,
  parameters: { design: 'COMPONENTE.md §0i · Toast de progres pentru operații lungi (export/import)' },
  args: {
    title: 'Se exportă situația plăților…',
    progress: 62,
    detail: '62 din 100 de copii',
    onCancel: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ProgressToast>;

export const Default: Story = {};

export const Nedeterminat: Story = { args: { progress: undefined, detail: undefined } };
