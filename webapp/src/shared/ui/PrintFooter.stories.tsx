import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrintFooter } from './PrintFooter';

const meta: Meta<typeof PrintFooter> = {
  title: 'Tipare de pagină/PrintFooter',
  component: PrintFooter,
  parameters: { design: 'DS Componente.dc.html#32f — subsol A4 (Situația plăților, StatusPrint.tsx)' },
  args: { children: 'Sume în lei.', printedAt: '2026-09-30T10:00:00.000Z' },
};
export default meta;

type Story = StoryObj<typeof PrintFooter>;

export const Default: Story = {};
