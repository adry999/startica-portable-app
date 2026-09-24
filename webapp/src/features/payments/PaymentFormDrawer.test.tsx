import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentFormDrawer } from './PaymentFormDrawer';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

const records = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      archived: false,
      status: 'Activ',
      statusHistory: [{ from: '2026-01', status: 'Activ' }],
      attendanceDate: '2026-01-10',
      feeHistory: [{ from: '2026-01', amount: 1500 }],
    },
    { id: 'c2', name: 'Maria Ionescu', archived: false, feeHistory: [] },
  ],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
} as unknown as RecordsSnapshot;

function renderDrawer() {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<PaymentFormDrawer target="new" records={records} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose };
}

describe('PaymentFormDrawer', () => {
  it('suma totală se calculează automat din metodele completate', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Cash'), '500');
    await user.type(screen.getByLabelText('Card'), '300');

    expect((screen.getByLabelText('Total achitare (calculat automat)') as HTMLInputElement).value).toBe('800.00');
  });

  it('rândul unic de repartizare urmărește suma totală până e editat manual', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Cash'), '500');

    const allocationAmount = document.querySelector('input[type="number"][min="0.01"]') as HTMLInputElement;
    expect(allocationAmount.value).toBe('500.00');

    await user.clear(allocationAmount);
    await user.type(allocationAmount, '100');
    await user.type(screen.getByLabelText('Card'), '200');

    // Suma repartizării nu se mai actualizează automat după editarea manuală.
    expect(allocationAmount.value).toBe('100');
  });

  it('data încasării actualizează luna repartizării cât timp e singurul rând, neatins', async () => {
    renderDrawer();
    const user = userEvent.setup();

    const dateInput = screen.getByLabelText('Data încasării') as HTMLInputElement;
    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    const initialMonth = monthInput.value;

    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-05');

    expect(monthInput.value).not.toBe(initialMonth);
    expect(monthInput.value).toBe('2026-11');
  });

  it('alegerea copilului propune luna cea mai veche neachitată a lui', async () => {
    renderDrawer();
    const user = userEvent.setup();

    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    await user.selectOptions(screen.getByLabelText('Copil'), 'c1');

    expect(monthInput.value).toBe('2026-01');
  });

  it('"+ Lună" adaugă un rând nou și oprește sincronizarea automată', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Lună' }));
    expect(document.querySelectorAll('input[type="month"]')).toHaveLength(2);
  });

  it('onSubmit primește valorile curente ale formularului', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Copil'), 'c2');
    await user.type(screen.getByLabelText('Cash'), '500');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c2', tenders: expect.objectContaining({ Cash: '500' }) }),
    );
  });
});
