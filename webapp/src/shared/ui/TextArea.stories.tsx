import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextArea } from './TextArea';

const meta: Meta<typeof TextArea> = {
  title: 'Formular/TextArea',
  component: TextArea,
  parameters: { design: '14-sms.md · Sms.dc.html#11c' },
  args: { value: '', onChange: fn(), placeholder: 'Scrie un mesaj…', ariaLabel: 'Text liber' },
};
export default meta;

type Story = StoryObj<typeof TextArea>;

export const Default: Story = {};

export const Disabled: Story = { args: { value: '', ariaLabel: 'Câmp dezactivat', disabled: true } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(textarea).toHaveFocus();
  },
};
