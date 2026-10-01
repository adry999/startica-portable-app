import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AppBanner } from './AppBanner';

const meta: Meta<typeof AppBanner> = {
  title: 'Componente/AppBanner',
  component: AppBanner,
  parameters: { design: 'DS Componente 2.dc.html §34a — o singură bară, după prioritate' },
  args: {
    tone: 'error',
    message: 'Nu s-a putut salva ultima modificare.',
    action: { label: 'Reîncearcă', onClick: fn() },
  },
};
export default meta;

type Story = StoryObj<typeof AppBanner>;

export const Default: Story = {};

export const Info: Story = {
  args: { tone: 'info', message: 'Versiune nouă disponibilă.', action: undefined, onDismiss: fn() },
};

export const Warning: Story = {
  args: { tone: 'warning', message: 'Soldul SMS e scăzut.', action: undefined },
};

export const Offline: Story = {
  args: { tone: 'offline', message: 'Fără conexiune la internet.', action: undefined },
};
