import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PhoneInput } from './PhoneInput';

const meta: Meta<typeof PhoneInput> = {
  title: 'Formular/PhoneInput',
  component: PhoneInput,
  parameters: { design: 'COMPONENTE.md §0/25b · Copii.dc.html#2a' },
  args: { value: '', onChange: fn(), placeholder: '069123456', ariaLabel: 'Telefon' },
};
export default meta;

type Story = StoryObj<typeof PhoneInput>;

export const Default: Story = {};

/** Mobil moldovenesc valid — sub câmp apare „069 123 456”, aceeași formă ca în câmp. */
export const Valid: Story = { args: { value: '069123456', ariaLabel: 'Telefon' } };

/** Scris de-a gata ca E.164 (venit dintr-o fișă salvată) — arată identic cu `Valid`. */
export const SavedAsE164: Story = { args: { value: '+37369123456', ariaLabel: 'Telefon' } };

/** Prea puține cifre — mesajul specific „Număr incomplet”, nu cel generic. */
export const Incomplete: Story = { args: { value: '123', ariaLabel: 'Telefon' } };

/** Prefix cu cifre complete, dar care nu e din lista de mobile moldovenești. */
export const Invalid: Story = { args: { value: '022123456', ariaLabel: 'Telefon' } };

/** „Alt număr” (§10) — prefix „+” nemoldovenesc, acceptat ca atare, fără eroare. */
export const Foreign: Story = { args: { value: '+40 721 000 000', ariaLabel: 'Telefon' } };

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};
