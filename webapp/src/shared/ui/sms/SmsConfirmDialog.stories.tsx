import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { fn } from 'storybook/test';
import { createDemoSmsResult, DEMO_SMS_RECIPIENTS } from '../stories.fixtures';
import { SmsConfirmDialog } from './SmsConfirmDialog';

const meta: Meta<typeof SmsConfirmDialog> = {
  title: 'Tipare de pagină/SmsConfirmDialog',
  component: SmsConfirmDialog,
  parameters: {
    design: '14-sms.md · 07-situatia.md §7c (unic) / §7d–#7e (lot) · vizual în Situatia.dc.html#7c–#7e',
  },
  decorators: [
    Story => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    open: true,
    unitCostLei: 0.3,
    balanceLei: 120,
    onSend: async ids => createDemoSmsResult(ids),
    onClose: fn(),
    onSent: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof SmsConfirmDialog>;

export const Default: Story = {
  args: { mode: 'single', recipients: DEMO_SMS_RECIPIENTS.slice(0, 1) },
};

export const Bulk: Story = {
  args: { mode: 'bulk', recipients: DEMO_SMS_RECIPIENTS, onRetry: async ids => createDemoSmsResult(ids) },
};
