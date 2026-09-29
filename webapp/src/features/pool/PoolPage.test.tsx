import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { PoolPage } from './PoolPage';

const { weekReload, monthReload, saveBookingMock } = vi.hoisted(() => ({
  weekReload: vi.fn(),
  monthReload: vi.fn(),
  saveBookingMock: vi.fn().mockResolvedValue({ booking: {} }),
}));

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({ state: { state: { children: [] } } }),
}));

vi.mock('./BookingDrawer', () => ({
  // Fixture minimală: un buton „Salvat” care declanșează direct onSaved(), fără să reproducă
  // toată interacțiunea SearchSelect/select din formularul real (nu asta se testează aici).
  BookingDrawer: (props: { open: boolean; onSaved: () => void }) =>
    props.open ? (
      <button type="button" onClick={props.onSaved}>
        Salvat (fixture)
      </button>
    ) : null,
}));

vi.mock('@shared/pool/usePool', () => ({
  usePoolWeek: () => ({
    days: [],
    stats: { scheduled: 0, present: 0, absent: 0, excused: 0 },
    loading: false,
    reload: weekReload,
    markSession: vi.fn(),
  }),
  usePoolMonth: () => ({
    children: [],
    coaches: [],
    closing: null,
    unmarked: 0,
    loading: false,
    closingBusy: false,
    closeError: '',
    reload: monthReload,
    closeMonth: vi.fn(),
  }),
  usePoolSettings: () => ({
    settings: {
      pricePerSession: 150,
      durationMin: 45,
      hoursFrom: '08:00',
      hoursTo: '18:00',
      seatsPerSlot: 4,
      chargeUnexcusedAbsence: true,
      coachPayMode: 'per_child',
      coachRate: 60,
      itemsNote: '',
    },
    seed: null,
    coaches: [{ id: 'STF-1', name: 'Rusu Vlad' }],
    loading: false,
    save: vi.fn(),
    reload: vi.fn(),
  }),
  saveBooking: saveBookingMock,
  endBooking: vi.fn(),
}));

function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function renderPage() {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <PoolPage month="2026-09" />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

describe('PoolPage', () => {
  it('eticheta săptămânii reflectă intervalul afișat, nu un text fix (A-8)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Nu mai apare textul static „Săptămâna curentă”.
    expect(screen.queryByText('Săptămâna curentă')).not.toBeInTheDocument();
    const firstLabel = screen.getByLabelText('Săptămâna următoare').previousSibling?.textContent;
    expect(firstLabel).toMatch(/\d+.*–.*\d+/);

    await user.click(screen.getByLabelText('Săptămâna următoare'));
    const nextLabel = screen.getByLabelText('Săptămâna următoare').previousSibling?.textContent;
    expect(nextLabel).not.toBe(firstLabel);
  });

  it('o programare nouă reîncarcă atât săptămâna cât și luna, nu doar săptămâna (A-8)', async () => {
    const user = userEvent.setup();
    weekReload.mockClear();
    monthReload.mockClear();
    renderPage();

    await user.click(screen.getByText('+ Programare nouă'));
    await user.click(screen.getByText('Salvat (fixture)'));

    expect(weekReload).toHaveBeenCalledTimes(1);
    expect(monthReload).toHaveBeenCalledTimes(1);
  });
});
