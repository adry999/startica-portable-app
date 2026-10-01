import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DayGrid, type DayGridRow } from './DayGrid';

const DAY_GRID_COLUMNS = ['1', '2', '3', '4', '5', '6', '7'];

const PREZENTA_ROWS: DayGridRow[] = [
  {
    key: 'r1',
    label: 'Ionescu Maria',
    cells: [
      { key: 'c1', tone: 'mint', ariaLabel: '1 septembrie, prezent', onClick: fn() },
      { key: 'c2', tone: 'mint', ariaLabel: '2 septembrie, prezent', onClick: fn() },
      { key: 'c3', isWeekend: true, ariaLabel: '3 septembrie, weekend' },
      { key: 'c4', isWeekend: true, ariaLabel: '4 septembrie, weekend' },
      { key: 'c5', tone: 'raspberry', ariaLabel: '5 septembrie, absent', onClick: fn() },
      { key: 'c6', isToday: true, tone: 'mint', ariaLabel: '6 septembrie, prezent', saving: true },
      { key: 'c7', tone: 'neutral', ariaLabel: '7 septembrie, neconsemnat', onClick: fn() },
    ],
  },
];

const PONTAJ_ROWS: DayGridRow[] = [
  {
    key: 'p1',
    label: 'Rusu Ana',
    cells: [
      { key: 'p1c1', content: '8h', ariaLabel: '1 septembrie, 8 ore', onClick: fn() },
      { key: 'p1c2', content: 'CO', tone: 'yellow', ariaLabel: '2 septembrie, concediu odihnă', onClick: fn() },
      { key: 'p1c3', isWeekend: true, ariaLabel: '3 septembrie, weekend' },
      { key: 'p1c4', isWeekend: true, ariaLabel: '4 septembrie, weekend' },
      { key: 'p1c5', content: '8h', isToday: true, ariaLabel: '5 septembrie, 8 ore', onClick: fn() },
      { key: 'p1c6', content: 'CM', tone: 'raspberry', ariaLabel: '6 septembrie, concediu medical', onClick: fn() },
      { key: 'p1c7', content: '4h', ariaLabel: '7 septembrie, 4 ore', onClick: fn() },
    ],
  },
];

const LOADING_ROWS: DayGridRow[] = [
  {
    key: 'l1',
    label: 'Popescu Andrei',
    loading: true,
    cells: DAY_GRID_COLUMNS.map((_, index) => ({
      key: `l${index}`,
      isWeekend: index === 2 || index === 3,
      ariaLabel: 'Se încarcă',
    })),
  },
];

const meta: Meta<typeof DayGrid> = {
  title: 'Aplicație/DayGrid',
  component: DayGrid,
  parameters: {
    design: '18b Prezența Luna · 23e Pontaj · 23f Concedii — vizual în Prezenta.dc.html#18b, Personal.dc.html#23e/23f',
  },
  args: {
    kind: 'dot',
    columnLabels: DAY_GRID_COLUMNS,
    rows: PREZENTA_ROWS,
    footer: ['1', '2', '—', '—', '1', '2', '2'],
  },
};
export default meta;

type Story = StoryObj<typeof DayGrid>;

export const Default: Story = {};

export const CodeKind: Story = {
  args: { kind: 'code', rows: PONTAJ_ROWS, footer: undefined },
};

export const Loading: Story = {
  args: { rows: LOADING_ROWS, footer: undefined },
};
