import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart } from './BarChart';

const SERIES = [
  { label: 'Apr', value: 32000 },
  { label: 'Mai', value: 38000 },
  { label: 'Iun', value: 29000 },
  { label: 'Iul', value: 41000 },
  { label: 'Aug', value: 35000 },
  { label: 'Sep', value: 45000, current: true },
];

const SECONDARY_SERIES = [
  { label: 'Apr', value: 21000 },
  { label: 'Mai', value: 24000 },
  { label: 'Iun', value: 19000 },
  { label: 'Iul', value: 27000 },
  { label: 'Aug', value: 23000 },
  { label: 'Sep', value: 29000, current: true },
];

const meta: Meta<typeof BarChart> = {
  title: 'Date și grafice/BarChart',
  component: BarChart,
  parameters: { design: 'DS Date si grafice.dc.html §30d — 2 serii, luna curentă intensă' },
  args: {
    ariaLabel: 'Încasări și cheltuieli pe ultimele 6 luni',
    series: SERIES,
    secondarySeries: SECONDARY_SERIES,
  },
};
export default meta;

type Story = StoryObj<typeof BarChart>;

export const Default: Story = {};

export const Loading: Story = { args: { series: [], state: 'loading', ariaLabel: 'Se încarcă' } };

export const Empty: Story = { args: { series: [], state: 'empty', ariaLabel: 'Fără date' } };

// F23 (PROMPT-11 §11): coloană de scară (0/jumătate/max), linii de referință, axă de jos, valoare
// deasupra barei principale, „în curs” sub luna curentă — ca „Evoluția încasărilor” din Dashboard.
export const CuScara: Story = {
  args: {
    grouped: true,
    showScale: true,
    currentLabelHint: 'în curs',
    groupAriaLabel: (item, secondary) => `${item.label}: încasări ${item.value}, cheltuieli ${secondary?.value}`,
    groupTooltip: (item, secondary) =>
      `${item.label} · încasări ${item.value} lei · cheltuieli ${secondary?.value} lei · diferență ${item.value - (secondary?.value ?? 0)} lei`,
  },
};

export const Grouped: Story = {
  args: {
    ariaLabel: 'Încasări și cheltuieli pe ultimele 3 luni',
    grouped: true,
    series: [
      { label: 'Iul', value: 41000 },
      { label: 'Aug', value: 0 },
      { label: 'Sep', value: 45000, current: true },
    ],
    secondarySeries: [
      { label: 'Iul', value: 27000 },
      { label: 'Aug', value: 0 },
      { label: 'Sep', value: 32000, current: true },
    ],
    groupAriaLabel: (item, secondary) => `${item.label}: încasări ${item.value}, cheltuieli ${secondary?.value}`,
    groupTooltip: (item, secondary) => `diferență ${item.value - (secondary?.value ?? 0)} lei`,
  },
};
