import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChipSelect } from './ChipSelect';

const meta: Meta<typeof ChipSelect> = {
  title: 'Formular/ChipSelect',
  component: ChipSelect,
  parameters: { design: 'COMPONENTE.md §2 id 22b · Bazin.dc.html#22b' },
  args: {
    ariaLabel: 'Ziua',
    value: '1',
    onChange: fn(),
    options: [
      { value: '1', label: 'Lu' },
      { value: '2', label: 'Ma' },
      { value: '3', label: 'Mi' },
      { value: '4', label: 'Jo' },
      { value: '5', label: 'Vi' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof ChipSelect>;

export const Default: Story = {};

/** F2 (FEEDBACK-01-10.md, 38b) — ocupare/capacitate; grupa plină e `pink`, rămâne selectabilă. */
export const OcupareGrupe: Story = {
  args: {
    ariaLabel: 'Grupă',
    value: '1',
    options: [
      { value: '', label: 'Fără grupă' },
      { value: '1', label: 'Neptun · 8/12', tone: 'orange', hint: '8 din 12 locuri ocupate' },
      { value: '2', label: 'Venus · 12/12', tone: 'pink', hint: '12 din 12 locuri ocupate' },
      { value: '3', label: 'Sirius · 6', tone: 'yellow', hint: 'Fără limită de capacitate' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    ariaLabel: 'Opțiune dezactivată',
    value: '',
    options: [{ value: 'x', label: 'Indisponibil', disabled: true }],
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('radio', { name: 'Ma' });
    await userEvent.hover(chip);
    await expect(chip).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const chip = canvas.getByRole('radio', { name: 'Lu' });
    await expect(chip).toHaveFocus();
  },
};
