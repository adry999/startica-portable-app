import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignatureLine } from './SignatureLine';

const meta: Meta<typeof SignatureLine> = {
  title: 'Componente/SignatureLine',
  component: SignatureLine,
  parameters: {
    design:
      'DS Componente.dc.html#32f — bară + etichetă (Achitări, Bazin: PaymentReceipt/PaymentReceiptThermal/DayClosingReceipt)',
  },
  args: { children: 'Primit: administrator' },
};
export default meta;

type Story = StoryObj<typeof SignatureLine>;

export const Default: Story = {};
