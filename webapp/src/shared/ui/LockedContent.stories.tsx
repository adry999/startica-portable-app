import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { LockedContent } from './LockedContent';

const meta: Meta<typeof LockedContent> = {
  title: 'Componente/LockedContent',
  component: LockedContent,
  parameters: {
    design: 'COMPONENTE.md §0i (34f) · prima folosire în features/personal/PinGate.tsx — PIN-ul demo e „1234”',
  },
  args: {
    unlocked: false,
    onUnlock: async pin => {
      if (pin !== '1234') return { ok: false, message: 'PIN greșit.' };
      return { ok: true, message: '' };
    },
    onLock: fn(),
    title: 'Salariile sunt protejate',
    subtitle: 'Introdu PIN-ul administrator (4–6 cifre).',
    inputAriaLabel: 'PIN demo',
    hint: 'Demo: PIN-ul corect e 1234.',
    children: <p>Conținutul protejat, vizibil doar deblocat.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof LockedContent>;

export const Default: Story = {};

export const Deblocat: Story = { args: { unlocked: true } };

export const Loading: Story = { args: { loading: true } };
