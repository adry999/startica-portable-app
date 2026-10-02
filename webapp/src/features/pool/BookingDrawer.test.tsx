import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { BookingDrawer } from './BookingDrawer';
import type { PoolSettings } from '#features/pool/pool.types.d.mts';

const { saveBookingMock } = vi.hoisted(() => ({
  saveBookingMock: vi.fn(),
}));

vi.mock('@shared/api/session', () => ({
  useAppSession: () => ({
    state: { state: { children: [{ id: 'C1', name: 'Ana Popescu', archived: false }] } },
  }),
}));

vi.mock('@shared/pool/usePool', () => ({
  saveBooking: saveBookingMock,
}));

const settings: PoolSettings = {
  enabled: true,
  pricePerSession: 150,
  durationMin: 45,
  hoursFrom: '08:00',
  hoursTo: '09:00',
  seatsPerSlot: 4,
  chargeUnexcusedAbsence: true,
  coachPayMode: 'per_child',
  coachRate: 60,
  itemsNote: '',
};

function renderDrawer() {
  return render(
    <ToastProvider>
      <BookingDrawer
        open
        onClose={() => {}}
        onSaved={() => {}}
        settings={settings}
        coaches={[{ id: 'STF-1', name: 'Rusu Vlad' }]}
        today="2026-09-01"
        weekDays={[]}
      />
    </ToastProvider>,
  );
}

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Copil' }));
  await user.click(await screen.findByText('Ana Popescu'));
  await user.click(screen.getByText('08:00'));
}

describe('BookingDrawer', () => {
  it(// AUDIT-COD-02-10.md #3: `form.requestSubmit()` (declanșat de Ctrl+Enter, PROMPT-9 §3)
  // ocolește complet starea `disabled` a butonului — un clic normal pornește salvarea (butonul
  // devine disabled), dar dacă userul apasă Ctrl+Enter CÂT TIMP cererea e încă în curs, asta tot
  // trimite submit pe `<form>`, fără să treacă prin butonul dezactivat. Fără gardă proprie în
  // `submit()`, asta ar crea o a doua rezervare pentru același interval.
  'un Ctrl+Enter (requestSubmit direct pe form) cât timp prima salvare e în curs nu creează a doua rezervare', async () => {
    let resolveSave: (value: { booking: object }) => void = () => {};
    saveBookingMock.mockReturnValue(new Promise(resolve => (resolveSave = resolve)));
    renderDrawer();
    await fillRequiredFields();

    const submitButton = screen.getByRole('button', { name: 'Programează' });
    await userEvent.setup().click(submitButton);
    expect(saveBookingMock).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();

    // Ctrl+Enter nu verifică starea butonului — trimite direct pe `<form>`.
    const form = document.getElementById('booking-form') as HTMLFormElement;
    act(() => {
      form.requestSubmit();
    });

    expect(saveBookingMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave({ booking: {} });
      await Promise.resolve();
    });
  });
});
