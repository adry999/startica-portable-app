import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThermalBlock, ThermalRule } from './ThermalBlock';

const meta: Meta<typeof ThermalBlock> = {
  title: 'Tipare de pagină/ThermalBlock',
  component: ThermalBlock,
  parameters: {
    design:
      'DS Componente.dc.html#32f — bon 58mm (Achitări/Bazin: PaymentReceiptThermal, DayClosingReceipt, PoolReceiptLabel)',
  },
  args: {
    actions: (
      <button type="button" onClick={() => {}}>
        Tipărește
      </button>
    ),
    children: (
      <>
        <span>ÎNCHIDEREA ZILEI</span>
        <ThermalRule />
        <span>Total: 1 250 lei</span>
        <ThermalRule variant="dashed" />
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof ThermalBlock>;

export const Default: Story = {};

export const WithoutActions: Story = { args: { actions: undefined } };
