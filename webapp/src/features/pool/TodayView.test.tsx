import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TodayView } from './TodayView';
import type { TodaySession } from './today-sessions';

const sessions: TodaySession[] = [
  { time: '09:00', coachLabel: 'Popescu Ana', childCount: 8, unmarkedCount: 0, isCurrent: false },
  { time: '11:00', coachLabel: 'Ciobanu Elena', childCount: 9, unmarkedCount: 4, isCurrent: true },
  { time: '16:00', coachLabel: 'Fără antrenor', childCount: 2, unmarkedCount: 2, isCurrent: false },
];

describe('TodayView (43b)', () => {
  it('arată schelet de încărcare', () => {
    render(<TodayView status="loading" dateLabel="Bazin · joi, 2 octombrie" sessions={[]} onMark={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
  });

  it('arată data, numărul de ședințe și de copii, din ședințele date', () => {
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={vi.fn()} />);
    expect(screen.getByText('Bazin · joi, 2 octombrie')).toBeInTheDocument();
    expect(screen.getByText('3 ședințe · 19 copii')).toBeInTheDocument();
  });

  it('arată ora, antrenorul și numărul de copii pe fiecare rând', () => {
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={vi.fn()} />);
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Popescu Ana')).toBeInTheDocument();
    expect(screen.getByText('8 copii')).toBeInTheDocument();
    expect(screen.getByText('Fără antrenor')).toBeInTheDocument();
  });

  it('starea de marcare: toate marcate, parțial, de marcat', () => {
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={vi.fn()} />);
    expect(screen.getByText('Toate marcate')).toBeInTheDocument();
    expect(screen.getByText('5/9 marcate')).toBeInTheDocument();
    expect(screen.getByText('De marcat')).toBeInTheDocument();
  });

  it('ședința în curs e evidențiată (fundal distinct)', () => {
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={vi.fn()} />);
    const current = screen.getByText('11:00').closest('div[class]');
    expect(current?.className).toMatch(/current/);
    const notCurrent = screen.getByText('09:00').closest('div[class]');
    expect(notCurrent?.className).not.toMatch(/current/);
  });

  it('clic pe „Marchează” cheamă onMark cu ședința rândului respectiv', async () => {
    const onMark = vi.fn();
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={onMark} />);
    const user = userEvent.setup();
    const row = screen.getByText('11:00').closest('div[class]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Marchează' }));
    expect(onMark).toHaveBeenCalledWith(sessions[1]);
  });

  it('fără nicio ședință azi, arată starea goală', () => {
    render(<TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={[]} onMark={vi.fn()} />);
    expect(screen.getByText('Nicio ședință azi')).toBeInTheDocument();
    expect(screen.getByText('0 ședințe · 0 copii')).toBeInTheDocument();
  });

  it('fără axe violations', async () => {
    const { container } = render(
      <TodayView status="ready" dateLabel="Bazin · joi, 2 octombrie" sessions={sessions} onMark={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
