import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RateCalendar } from './RateCalendar';

function buildRates() {
  const rates: Record<string, number> = {};
  const sources: Record<string, 'bnm' | 'manual'> = {};
  for (let day = 5; day <= 30; day++) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(2026, 8, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (day === 21) continue; // o zi lipsă, pe lângă weekend
    rates[date] = 19.7 + day / 100;
    sources[date] = day === 10 ? 'manual' : 'bnm';
  }
  return { rates, sources };
}

const meta: Meta<typeof RateCalendar> = {
  title: 'Aplicație/RateCalendar',
  component: RateCalendar,
  parameters: { design: '38e — calendarul lunar al cursului BNM, cu weekend, corecții manuale și zile lipsă' },
  args: {
    month: '2026-09',
    ...buildRates(),
    onMonthChange: fn(),
    onBackfill: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof RateCalendar>;

export const Default: Story = {};

export const SeIncarca: Story = { args: { backfilling: true } };
