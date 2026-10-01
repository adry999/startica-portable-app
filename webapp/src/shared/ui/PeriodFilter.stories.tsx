import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PeriodFilter } from './PeriodFilter';

const meta: Meta<typeof PeriodFilter> = {
  title: 'Tabel și filtre/PeriodFilter',
  component: PeriodFilter,
  parameters: { design: 'DS Tabel si filtre.dc.html §27e' },
  args: {
    preset: 'tot',
    from: '',
    to: '',
    onPresetChange: fn(),
    onFromChange: fn(),
    onToChange: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof PeriodFilter>;

/** „Tot” — presetarea implicită în Achitări (mockup: „Perioadă: oricând”). */
export const Default: Story = {};

export const LunaAceasta: Story = {
  args: { preset: 'luna', from: '2026-09-01', to: '2026-09-30' },
};

export const LunaTrecuta: Story = {
  args: { preset: 'luna-trecuta', from: '2026-08-01', to: '2026-08-31' },
};

export const Ultimele30Zile: Story = {
  args: { preset: '30z', from: '2026-08-31', to: '2026-09-29' },
};

export const AnulScolarCurent: Story = {
  args: { preset: 'an-scolar', from: '2025-09-01', to: '2026-08-31' },
};

/** Deschide meniul și alege „Interval personalizat” ca să vezi cele 2 `DateInput`. */
export const IntervalPersonalizat: Story = {
  args: { preset: 'interval', from: '2026-09-01', to: '2026-09-15' },
};
