import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { MonthView, type MonthViewProps } from './MonthView';

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
    });
    expect(screen.getByRole('button', { name: 'Închide luna' })).toBeEnabled();
  });

  it('meniul rândului copilului are opțiunea „Bon 58 mm”', () => {
    renderMonthView({
      month: '2026-09',
      children: [
        {
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
          bookings: [],
          sessions: [],
        },
      ],
      coaches: [],
      closing: null,
      unmarked: 0,
      closingBusy: false,
      closeError: '',
      onCloseMonth: vi.fn(),
    });
    expect(screen.getByLabelText('Mai multe acțiuni')).toBeInTheDocument();
    expect(screen.getByText('Bon 58 mm')).toBeInTheDocument();
  });
});
