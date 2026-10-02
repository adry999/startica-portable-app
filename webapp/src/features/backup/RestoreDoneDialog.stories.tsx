import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RestoreDoneDialog } from './RestoreDoneDialog';

const meta: Meta<typeof RestoreDoneDialog> = {
  title: 'Backup/RestoreDoneDialog',
  component: RestoreDoneDialog,
  parameters: { design: 'Prima pornire.dc.html#46d — restaurare arhivă: reîncărcare' },
  args: {
    open: true,
    branchCount: 2,
    onReload: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof RestoreDoneDialog>;

export const Default: Story = {};

export const OSingurăFilială: Story = { args: { branchCount: 1 } };
