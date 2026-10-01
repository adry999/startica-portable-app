import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RateCalendar } from './RateCalendar';

// Septembrie 2026: 1 e marți, 5-6 e weekend, restul lunii are curs doar în zilele lucrătoare.
// Ziua 1 rămâne fără curs (nicio zi anterioară cunoscută) — adevărata „zi lipsă”, spre deosebire
// de weekend, unde eurToMdlRate cade pe cursul de vineri.
function buildRates() {
  const rates: Record<string, number> = {};
  const sources: Record<string, 'bnm' | 'manual'> = {};
  for (let day = 2; day <= 30; day++) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(2026, 8, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue; // weekendul n-are curs propriu
    rates[date] = 19.7 + day / 100;
    sources[date] = day === 10 ? 'manual' : 'bnm';
  }
  return { rates, sources };
}

describe('RateCalendar', () => {
  it('arată cursul fiecărei zile lucrătoare din lună', () => {
    const { rates, sources } = buildRates();
    render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={() => {}} />,
    );
    expect(screen.getByText('19,7200')).toBeInTheDocument(); // 2 septembrie
  });

  it('weekendul arată cursul de vineri, pe celula marcată distinct', () => {
    const { rates, sources } = buildRates();
    render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={() => {}} />,
    );
    // 5 septembrie 2026 e sâmbătă — n-are curs propriu, arată cursul de vineri (4 septembrie).
    const saturday = screen.getByText('5').parentElement;
    expect(saturday?.className).toMatch(/weekendCell/);
    expect(saturday?.textContent).toContain('19,7400');
  });

  it('ziua corectată manual are celula marcată distinct', () => {
    const { rates, sources } = buildRates();
    render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={() => {}} />,
    );
    const manualDay = screen.getByText('10').parentElement;
    expect(manualDay?.className).toMatch(/manualCell/);
  });

  it('zilele lipsă nu arată niciun curs', () => {
    // Istoricul începe abia pe 15 — 7 septembrie n-are niciun curs anterior cunoscut pe care să cadă.
    const rates = { '2026-09-15': 19.85 };
    const sources = { '2026-09-15': 'bnm' as const };
    render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={() => {}} />,
    );
    const missingDay = screen.getByText('7').parentElement;
    expect(missingDay?.textContent).toBe('7');
  });

  it('butoanele de navigare schimbă luna', async () => {
    const onMonthChange = vi.fn();
    const { rates, sources } = buildRates();
    render(
      <RateCalendar
        month="2026-09"
        onMonthChange={onMonthChange}
        rates={rates}
        sources={sources}
        onBackfill={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Luna următoare' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-10');
    await userEvent.click(screen.getByRole('button', { name: 'Luna anterioară' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-08');
  });

  it('apelează onBackfill la „Vezi încă 10 zile”', async () => {
    const onBackfill = vi.fn();
    const { rates, sources } = buildRates();
    render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={onBackfill} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Vezi încă 10 zile' }));
    expect(onBackfill).toHaveBeenCalledOnce();
  });

  it('dezactivează „Vezi încă 10 zile” cât timp se încarcă', () => {
    const { rates, sources } = buildRates();
    render(
      <RateCalendar
        month="2026-09"
        onMonthChange={() => {}}
        rates={rates}
        sources={sources}
        onBackfill={() => {}}
        backfilling
      />,
    );
    expect(screen.getByRole('button', { name: 'Vezi încă 10 zile' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { rates, sources } = buildRates();
    const { container } = render(
      <RateCalendar month="2026-09" onMonthChange={() => {}} rates={rates} sources={sources} onBackfill={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
