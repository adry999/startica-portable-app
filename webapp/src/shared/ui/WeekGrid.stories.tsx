import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WeekGrid, type WeekGridEvent } from './WeekGrid';

const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
const HOUR_LABELS = ['09:00', '10:00', '11:00', '12:00', '13:00'];

const EVENTS: WeekGridEvent[] = [
  { key: 'w1', dayIndex: 0, startRow: 0, rowSpan: 2, label: 'Grupa Delfin', onClick: fn() },
  { key: 'w2', dayIndex: 2, startRow: 1, rowSpan: 1, label: 'Grupa Balena', onClick: fn() },
  { key: 'w3', dayIndex: 5, startRow: 3, rowSpan: 2, label: 'Grup privat', onClick: fn() },
];

const meta: Meta<typeof WeekGrid> = {
  title: 'Aplicație/WeekGrid',
  component: WeekGrid,
  parameters: { design: 'Bazin — programări săptămânale, vizual în Bazin.dc.html#30g' },
  args: {
    dayLabels: DAY_LABELS,
    hourLabels: HOUR_LABELS,
    events: EVENTS,
    onEmptyCellClick: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof WeekGrid>;

export const Default: Story = {};

export const Loading: Story = { args: { events: [], loading: true } };
