import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MonthCalendar, type MonthCalendarDay } from './MonthCalendar';

const weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function makeDays(): MonthCalendarDay[] {
  const days: MonthCalendarDay[] = [];
  for (let i = 1; i <= 7; i++) {
    days.push({
      date: `2026-09-0${i}`,
      dayNumber: i,
      isCurrentMonth: i !== 1,
      isToday: i === 3,
      events:
        i === 5
          ? [
              { key: 'e1', label: 'Aniversare Maria', tone: 'orange' },
              { key: 'e2', label: 'Vizită medic', tone: 'mint' },
              { key: 'e3', label: 'Excursie', tone: 'yellow' },
              { key: 'e4', label: 'Concediu Ana', tone: 'teal' },
            ]
          : [],
    });
  }
  return days;
}

describe('MonthCalendar', () => {
  it('randează etichetele zilelor săptămânii și numerele zilelor', () => {
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} />);
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('afișează maximum `maxVisibleEvents` pastile și un indicator „+N”', () => {
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} maxVisibleEvents={3} />);
    expect(screen.getByText('Aniversare Maria')).toBeInTheDocument();
    expect(screen.getByText('Vizită medic')).toBeInTheDocument();
    expect(screen.getByText('Excursie')).toBeInTheDocument();
    expect(screen.queryByText('Concediu Ana')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('zilele din altă lună au marcajul `adjacent`', () => {
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} />);
    const firstDay = screen.getByText('1').closest('button');
    expect(firstDay?.className).toMatch(/adjacent/);
  });

  it('zilele sunt butoane, chiar și fără onSelect (dezactivate)', () => {
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} />);
    expect(screen.getByRole('button', { name: /^2$/ })).toBeDisabled();
  });

  it('apelează onSelect cu data zilei la click', async () => {
    const onSelect = vi.fn();
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /^2$/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-09-02');
  });

  it('ziua selectată primește marcajul `selected`', () => {
    render(
      <MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} selected="2026-09-02" onSelect={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /^2$/ }).className).toMatch(/selected/);
  });

  it('cellHeight fixează înălțimea minimă a celulei', () => {
    render(<MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} cellHeight={140} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /^2$/ })).toHaveStyle({ minHeight: '140px' });
  });

  it('renderCell înlocuiește conținutul implicit al celulei', () => {
    render(
      <MonthCalendar
        weekdayLabels={weekdayLabels}
        days={makeDays()}
        renderCell={day => <span>Ziua custom {day.dayNumber}</span>}
      />,
    );
    expect(screen.getByText('Ziua custom 2')).toBeInTheDocument();
    expect(screen.queryByText('Aniversare Maria')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <MonthCalendar weekdayLabels={weekdayLabels} days={makeDays()} onSelect={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
