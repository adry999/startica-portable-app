import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { BranchSelector, type BranchOption } from './BranchSelector';

const BRANCHES: BranchOption[] = [
  { key: 'central', name: 'Filiala Centrală' },
  { key: 'nord', name: 'Filiala Nord' },
];

const meta: Meta<typeof BranchSelector> = {
  title: 'Aplicație/BranchSelector',
  component: BranchSelector,
  parameters: { design: '32b — comutarea filialei din antet' },
  args: { branches: BRANCHES, selectedKey: 'central', onChange: fn() },
};
export default meta;

type Story = StoryObj<typeof BranchSelector>;

export const Default: Story = {};
