import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RateCard } from './RateCard';

const meta: Meta<typeof RateCard> = {
  title: 'Aplicație/RateCard',
  component: RateCard,
  parameters: { design: '38e — cardul „Curs EUR” de azi, cu rândul „Mâine” apărut după publicarea BNM' },
  args: {
    rate: 19.74,
    rateDate: '2026-10-02',
    rateIsToday: true,
    tone: 'mint',
    primaryAction: { label: 'Corectează cursul de azi', onClick: fn() },
  },
};
export default meta;

type Story = StoryObj<typeof RateCard>;

export const Default: Story = {};

export const CuMaine: Story = {
  args: { tomorrow: { date: '2026-10-03', rate: 19.8, diff: 0.06 } },
};

export const CuMaineScadere: Story = {
  args: { tomorrow: { date: '2026-10-03', rate: 19.68, diff: -0.06 } },
};

export const CorectatManual: Story = {
  args: { tone: 'yellow', primaryAction: { label: 'Revino la cursul BNM', onClick: fn() } },
};

export const FaraCursCunoscut: Story = {
  args: {
    rate: undefined,
    rateDate: undefined,
    rateIsToday: false,
    tone: null,
    tomorrow: null,
    primaryAction: { label: 'Preia de la BNM', onClick: fn() },
  },
};

export const CursAnterior: Story = {
  args: { rateDate: '2026-09-30', rateIsToday: false, tomorrow: null },
};
