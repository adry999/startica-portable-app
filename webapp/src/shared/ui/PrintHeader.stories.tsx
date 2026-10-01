import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrintHeader } from './PrintHeader';

const meta: Meta<typeof PrintHeader> = {
  title: 'Tipare de pagină/PrintHeader',
  component: PrintHeader,
  parameters: { design: 'DS Componente.dc.html#32f — antet A4 (Situația plăților, StatusPrint.tsx)' },
  args: {
    title: 'Situația plăților · septembrie 2026',
    subtitle: 'Situație la 30.09.2026 · filtru: toți',
    aside: (
      <>
        <span>Grădinița Startica</span>
        <span>IDNO 1234567890123</span>
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof PrintHeader>;

export const Default: Story = {};

export const WithoutAside: Story = { args: { aside: undefined } };
