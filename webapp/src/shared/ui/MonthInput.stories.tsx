import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MonthInput } from './MonthInput';

const meta: Meta<typeof MonthInput> = {
  title: 'Formular/MonthInput',
  component: MonthInput,
  parameters: { design: 'DS Componente formular.dc.html §25b' },
  args: { value: '2026-09', onChange: fn(), ariaLabel: 'Luna' },
};
export default meta;

type Story = StoryObj<typeof MonthInput>;

export const Default: Story = {};

export const Invalid: Story = { args: { value: '', invalid: true } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

// §3 (PROMPT-11 F17): markers (achitat/restanță/deja aleasă), min/max și isDisabled — deschide
// popover-ul ca să vezi grila 4×3 cu punctele de stare și lunile dezactivate.
export const CuMarkeriSiLimite: Story = {
  args: {
    value: '2026-06',
    min: '2026-03',
    max: '2026-12',
    markers: { '2026-04': 'paid', '2026-05': 'debt', '2026-06': 'used' },
    isDisabled: month => month === '2026-10',
  },
};
