import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChoiceCards } from './ChoiceCards';

const meta: Meta<typeof ChoiceCards> = {
  title: 'Formular/ChoiceCards',
  component: ChoiceCards,
  parameters: { design: 'COMPONENTE.md §2 id 22b · Bazin.dc.html#22b' },
  args: {
    ariaLabel: 'Ora',
    value: '09:00',
    onChange: fn(),
    options: [
      { value: '09:00', title: '09:00', sub: '2 copii' },
      { value: '09:30', title: '09:30', sub: '0 copii' },
      { value: '10:00', title: '10:00', sub: '4 copii' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof ChoiceCards>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    options: [
      { value: '09:00', title: '09:00', sub: '2 copii' },
      { value: '09:30', title: '09:30', sub: '0 copii' },
      { value: '10:00', title: '10:00', sub: '4 copii', disabled: true },
    ],
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('radio', { name: /09:30/ });
    await userEvent.hover(card);
    await expect(card).toBeInTheDocument();
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const card = canvas.getByRole('radio', { name: /09:00/ });
    await expect(card).toHaveFocus();
  },
};
