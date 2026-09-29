import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { MonthView, type MonthViewProps } from './MonthView';

const { endBookingMock } = vi.hoisted(() => ({ endBookingMock: vi.fn() }));

vi.mock('@shared/pool/usePool', async () => {
  const actual = await vi.importActual<typeof import('@shared/pool/usePool')>('@shared/pool/usePool');
  return { ...actual, endBooking: endBookingMock };
});

function renderMonthView(props: MonthViewProps) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <MonthView {...props} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('MonthView', () => {
  it('Închide luna e dezactivat cât există ședințe nemarcate și arată motivul', () => {
    renderMonthView({
      month: '2026-09',
      children: [],
      coaches: [],
      closing: null,
      unmarked: 3,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
      onReload: vi.fn(),
    });
    expect(screen.getByRole('button', { name: 'Închide luna' })).toBeDisabled();
    expect(screen.getByText(/3 ședințe nemarcate/)).toBeInTheDocument();
  });

  it('cu toate ședințele marcate, butonul e activ', () => {
    renderMonthView({
      month: '2026-09',
      children: [],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
      onReload: vi.fn(),
    });
    expect(screen.getByRole('button', { name: 'Închide luna' })).toBeEnabled();
  });

  it('„Închide luna” cere confirmare cu ConfirmDeleteDialog (ÎNCHIDE), nu window.confirm (A-8)', async () => {
    const user = userEvent.setup();
    const onCloseMonth = vi.fn().mockResolvedValue(undefined);
    renderMonthView({
      month: '2026-09',
      children: [],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth,
      onReload: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Închide luna' }));
    expect(onCloseMonth).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Scrie ÎNCHIDE pentru confirmare'), 'ÎNCHIDE');
    await user.click(screen.getByRole('button', { name: 'Șterge definitiv' }));
    expect(onCloseMonth).toHaveBeenCalledTimes(1);
  });

  const bookingRow: MonthViewProps['children'][number] = {
    childId: 'C-1',
    child: { id: 'C-1', name: 'Copil test' } as MonthViewProps['children'][number]['child'],
    scheduled: 4,
    present: 4,
    absent: 0,
    excused: 0,
    cancelled: 0,
    unmarked: 0,
    amount: 600,
    charged: false,
    bookings: [
      {
        id: 'PB-1',
        childId: 'C-1',
        coachId: 'STF-1',
        weekday: 2,
        time: '10:30',
        startDate: '2026-09-01',
        endDate: null,
        archivedAt: null,
        updatedAt: '',
      },
    ],
    sessions: [],
  };

  it('meniul rândului copilului are opțiunile „Bon 58 mm” și „Oprește programarea”', () => {
    renderMonthView({
      month: '2026-09',
      children: [bookingRow],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
      onReload: vi.fn(),
    });
    expect(screen.getByLabelText('Mai multe acțiuni')).toBeInTheDocument();
    expect(screen.getByText('Bon 58 mm')).toBeInTheDocument();
    expect(screen.getByText('Oprește programarea')).toBeInTheDocument();
  });

  it('„Oprește programarea” cere data de final și cheamă endBooking (A-3)', async () => {
    endBookingMock.mockResolvedValue({ booking: { ...bookingRow.bookings[0], endDate: '2026-10-10' } });
    const onReload = vi.fn();
    const user = userEvent.setup();
    renderMonthView({
      month: '2026-09',
      children: [bookingRow],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
      onReload,
    });

    await user.click(screen.getByLabelText('Mai multe acțiuni'));
    await user.click(screen.getByText('Oprește programarea'));
    expect(screen.getByRole('dialog', { name: /Oprește programarea/ })).toBeInTheDocument();

    const dateInput = screen.getByLabelText('Ultima zi') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(endBookingMock).toHaveBeenCalledWith('PB-1', '2026-10-10');
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('„Oprește programarea” e dezactivat pentru un copil fără programări active', () => {
    renderMonthView({
      month: '2026-09',
      children: [{ ...bookingRow, bookings: [] }],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
      onReload: vi.fn(),
    });
    expect(screen.getByText('Oprește programarea').closest('button')).toBeDisabled();
  });
});
