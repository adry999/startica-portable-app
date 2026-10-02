import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EMPTY_STATES, resolveEmptyStateTitle } from '@shared/ui';
import { TodayView } from './TodayView';
import type { TodaySession } from './today-sessions';

const sessions: TodaySession[] = [
  { time: '09:00', coachLabel: 'Popescu Ana', childCount: 8, unmarkedCount: 0, isCurrent: false },
  { time: '11:00', coachLabel: 'Ciobanu Elena', childCount: 9, unmarkedCount: 4, isCurrent: true },
  { time: '16:00', coachLabel: 'Popescu Ana', childCount: 9, unmarkedCount: 9, isCurrent: false },
];

const meta: Meta<typeof TodayView> = {
  title: 'Bazin/TodayView',
  component: TodayView,
  parameters: { design: 'COMPONENTE.md §3b (TodayView) — Feedback 01-10.dc.html#43b' },
  args: {
    status: 'ready',
    dateLabel: 'Bazin · joi, 2 octombrie',
    sessions,
    onMark: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof TodayView>;

/** Ziua cu 3 ședințe: una încheiată (toate marcate), una în curs (parțial marcată, evidențiată), una viitoare (de marcat). */
export const Default: Story = {};

/** Schelet de încărcare — înainte ca săptămâna să fie gata. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Nicio ședință azi (zi liberă sau bazin fără programări în ziua curentă). */
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(resolveEmptyStateTitle(EMPTY_STATES['bazin.today.period']))).toBeInTheDocument();
  },
};

/** Clic pe „Marchează” cheamă `onMark` cu ședința rândului respectiv. */
export const ClickMarkOpensSession: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('button', { name: 'Marchează' });
    await userEvent.click(rows[1]);
    await expect(args.onMark).toHaveBeenCalledWith(sessions[1]);
  },
};
