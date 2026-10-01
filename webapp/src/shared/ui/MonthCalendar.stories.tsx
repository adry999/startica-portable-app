import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MonthCalendar, type MonthCalendarDay } from './MonthCalendar';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function buildDays(): MonthCalendarDay[] {
  const days: MonthCalendarDay[] = [];
  for (let i = -3; i < 39; i++) {
    const dayNumber = ((i % 30) + 30) % 30 || 30;
    const isCurrentMonth = i >= 0 && i < 30;
    const events =
      dayNumber === 12
        ? [
            { key: 'e1', label: 'Aniversare Coceva Alisa', tone: 'orange' as const },
            { key: 'e2', label: 'Vizită medic — Grupa Mars', tone: 'mint' as const },
            { key: 'e3', label: 'Excursie Grupa Delfin', tone: 'yellow' as const },
            { key: 'e4', label: 'Concediu Rusu Ana', tone: 'teal' as const },
          ]
        : dayNumber === 20
          ? [{ key: 'e5', label: 'Ședință părinți', tone: 'pink' as const }]
          : [];
    days.push({
      date: `2026-09-${String(dayNumber).padStart(2, '0')}`,
      dayNumber,
      isCurrentMonth,
      isToday: isCurrentMonth && dayNumber === 6,
      events,
    });
  }
  return days.slice(0, 42);
}

const meta: Meta<typeof MonthCalendar> = {
  title: 'Aplicație/MonthCalendar',
  component: MonthCalendar,
  parameters: { design: '30h — calendar lunar cu pastile de evenimente, zile din altă lună la .45' },
  args: {
    weekdayLabels: WEEKDAY_LABELS,
    days: buildDays(),
    onSelect: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof MonthCalendar>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };
