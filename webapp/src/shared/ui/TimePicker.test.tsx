import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker, type TimeSlot } from './TimePicker';

const SLOTS: TimeSlot[] = [
  { value: '09:00', capacity: { taken: 2, total: 4 } },
  { value: '09:30', capacity: { taken: 4, total: 4 } },
  { value: '10:00', loading: true },
];

describe('TimePicker', () => {
  it('afișează valoarea în câmpul de tastare', () => {
    render(<TimePicker value="10:00" onChange={() => {}} ariaLabel="Ora" />);
    expect(screen.getByLabelText('Ora')).toHaveValue('10:00');
  });

  it('apelează onChange când se tastează direct în câmp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimePicker value="" onChange={onChange} ariaLabel="Ora" />);
    await user.type(screen.getByLabelText('Ora'), '09:15');
    expect(onChange).toHaveBeenCalled();
  });

  it('nu arată declanșatorul de sloturi când slots lipsește', () => {
    render(<TimePicker value="10:00" onChange={() => {}} ariaLabel="Ora" />);
    expect(screen.queryByRole('button', { name: 'Deschide sloturile' })).not.toBeInTheDocument();
  });

  it('arată capacitatea fiecărui slot și dezactivează sloturile pline', async () => {
    const user = userEvent.setup();
    render(<TimePicker value="10:00" onChange={() => {}} ariaLabel="Ora" slots={SLOTS} />);
    await user.click(screen.getByRole('button', { name: 'Deschide sloturile' }));
    expect(screen.getByText('2/4 locuri')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /09:30/ })).toBeDisabled();
  });

  it('arată Spinner pentru sloturile loading', async () => {
    const user = userEvent.setup();
    render(<TimePicker value="10:00" onChange={() => {}} ariaLabel="Ora" slots={SLOTS} />);
    await user.click(screen.getByRole('button', { name: 'Deschide sloturile' }));
    expect(screen.getByRole('button', { name: /10:00/ })).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('selectează un slot disponibil și închide popover-ul', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimePicker value="10:00" onChange={onChange} ariaLabel="Ora" slots={SLOTS} />);
    await user.click(screen.getByRole('button', { name: 'Deschide sloturile' }));
    await user.click(screen.getByRole('button', { name: /09:00/ }));
    expect(onChange).toHaveBeenCalledWith('09:00');
    expect(screen.queryByRole('dialog', { name: 'Sloturi disponibile' })).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<TimePicker value="10:00" onChange={() => {}} ariaLabel="Ora" slots={SLOTS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
