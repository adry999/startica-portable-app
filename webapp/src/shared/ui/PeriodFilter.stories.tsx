import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PeriodFilter, periodPresetBounds, monthDayBounds, PERIOD_PRESET_OPTIONS } from './PeriodFilter';

// Dată fixă (nu `today()`) — povestea trebuie să fie identică la fiecare randare, ca DEMO_MONTH/DEMO_DAY.
const TODAY = '2026-09-27';

const meta: Meta<typeof PeriodFilter> = {
  title: 'Tabel și filtre/PeriodFilter',
  component: PeriodFilter,
  parameters: {
    design: 'DS Tabel si filtre.dc.html §27e',
    docs: { description: { component: `Opțiuni: ${PERIOD_PRESET_OPTIONS.map(option => option.label).join(', ')}.` } },
  },
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

// `periodPresetBounds` e aceeași funcție folosită de componentă — povestea arată exact ce ar calcula ea.
export const LunaAceasta: Story = {
  args: { preset: 'luna', ...periodPresetBounds('luna', TODAY) },
};

export const LunaTrecuta: Story = {
  args: { preset: 'luna-trecuta', ...periodPresetBounds('luna-trecuta', TODAY) },
};

export const Ultimele30Zile: Story = {
  args: { preset: '30z', ...periodPresetBounds('30z', TODAY) },
};

export const AnulScolarCurent: Story = {
  args: { preset: 'an-scolar', ...periodPresetBounds('an-scolar', TODAY) },
};

/** Cheltuieli (E-1): limitele unei luni fixe, independent de „azi” — `monthDayBounds`. */
export const IntervalPersonalizat: Story = {
  args: { preset: 'interval', ...monthDayBounds('2026-09') },
};
