import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CashSummaryCardView } from './CashSummaryCardView';

const meta: Meta<typeof CashSummaryCardView> = {
  title: 'Achitări/CashSummaryCard',
  component: CashSummaryCardView,
  parameters: { design: 'COMPONENTE.md §44c — Feedback 01-10.dc.html#44c' },
  args: {
    status: 'ready',
    dateLabel: 'Joi, 24.09.2026',
    paymentCount: 4,
    totalsByMethod: { Cash: 4500, Card: 2000, Transfer: 1200 },
    onFilterMethod: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof CashSummaryCardView>;

/** Ziua cu încasări pe toate cele 3 metode. */
export const Default: Story = {};

/** Schelet de încărcare — înainte ca sesiunea/ziua să fie gata. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Nicio achitare în ziua aleasă — totaluri zero, fără „Tipărește raportul zilei”. */
export const Empty: Story = {
  args: { paymentCount: 0, totalsByMethod: { Cash: 0, Card: 0, Transfer: 0 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('0 achitări')).toBeInTheDocument();
    await expect(canvas.queryByText('Tipărește raportul zilei')).not.toBeInTheDocument();
  },
};

/** Clic pe mini-cardul Cash cheamă `onFilterMethod('Cash')` — filtrul listei de dedesubt. */
export const ClickFiltersMethod: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Numerar/ }));
    await expect(args.onFilterMethod).toHaveBeenCalledWith('Cash');
  },
};
