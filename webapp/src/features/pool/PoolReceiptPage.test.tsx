import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PoolReceiptPage } from './PoolReceiptPage';

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({
    state: {
      state: {
        children: [{ id: 'C-1', name: 'Avram Maria', groupId: 'g1' }],
        groups: [{ id: 'g1', name: 'Mars' }],
      },
    },
  }),
}));

vi.mock('@shared/api/useKindergarten', () => ({
  useKindergarten: () => ({ ready: true, settings: { logoDataUrl: '' } }),
}));

vi.mock('@shared/pool/usePool', () => ({
  usePoolMonth: () => ({
    loading: false,
    children: [
      {
        childId: 'C-1',
        child: { id: 'C-1', name: 'Avram Maria', groupId: 'g1' },
        scheduled: 5,
        present: 4,
        absent: 0,
        excused: 0,
        cancelled: 1,
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
        sessions: [{ bookingId: 'PB-1', date: '2026-09-15', status: 'cancelled', updatedAt: '' }],
      },
    ],
    coaches: [
      {
        coachId: 'STF-1',
        coach: { id: 'STF-1', name: 'Rusu Vlad' },
        sessionsHeld: 4,
        childrenPresent: 4,
        rate: 60,
        mode: 'per_child',
        amount: 240,
      },
    ],
    closing: null,
    unmarked: 0,
  }),
  usePoolSettings: () => ({
    loading: false,
    settings: { pricePerSession: 150, itemsNote: 'Costum de baie, cască, prosop, papuci.' },
    seed: null,
    coaches: [],
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/bazin/bon/C-1?month=2026-09']}>
      <Routes>
        <Route path="/bazin/bon/:childId" element={<PoolReceiptPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PoolReceiptPage', () => {
  it('bonul de bazin listează ședințele lunii, cele anulate punctat, și totalul lunii', () => {
    const { container } = renderPage();

    expect(screen.getByText('Avram Maria')).toBeInTheDocument();
    expect(screen.getByText('Grupa Mars · antrenor Rusu Vlad')).toBeInTheDocument();
    expect(screen.getByText('Marți · 10:30')).toBeInTheDocument();
    // Marțile din septembrie 2026: 01, 08, 15, 22, 29 — 5 ședințe, una anulată (15) punctat.
    expect(container.querySelectorAll('[class*="sessionCell"]')).toHaveLength(5);
    expect(container.querySelectorAll('[class*="dashed"]')).toHaveLength(1);
    expect(screen.getByText(/5 ședințe × 150 lei = 600 lei/)).toBeInTheDocument();
    expect(screen.getByText('Costum de baie, cască, prosop, papuci.')).toBeInTheDocument();
  });
});
