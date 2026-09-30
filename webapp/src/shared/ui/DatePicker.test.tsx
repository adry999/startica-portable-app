import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('afișează valoarea în câmpul de tastare', () => {
    render(<DatePicker value="2026-09-15" onChange={() => {}} ariaLabel="Data" />);
    expect(screen.getByLabelText('Data')).toHaveValue('2026-09-15');
  });

  it('apelează onChange când se tastează direct în câmp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={onChange} ariaLabel="Data" />);
    await user.type(screen.getByLabelText('Data'), '2026-09-30');
    expect(onChange).toHaveBeenCalled();
  });

  it('deschide calendarul la clic pe declanșator și arată luna valorii curente', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-09-15" onChange={() => {}} ariaLabel="Data" />);
    await user.click(screen.getByRole('button', { name: 'Deschide calendarul' }));
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByText(/septembrie 2026/)).toBeInTheDocument();
  });

  it('selectează o zi din calendar și închide popover-ul', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="2026-09-15" onChange={onChange} ariaLabel="Data" />);
    await user.click(screen.getByRole('button', { name: 'Deschide calendarul' }));
    await user.click(screen.getByRole('button', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith('2026-09-20');
    expect(screen.queryByRole('dialog', { name: 'Calendar' })).not.toBeInTheDocument();
  });

  it('dezactivează zilele marcate de isDateDisabled', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        value="2026-09-15"
        onChange={() => {}}
        ariaLabel="Data"
        isDateDisabled={date => date === '2026-09-20'}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Deschide calendarul' }));
    expect(screen.getByRole('button', { name: '20' })).toBeDisabled();
  });

  it('navighează la luna următoare/precedentă', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-09-15" onChange={() => {}} ariaLabel="Data" />);
    await user.click(screen.getByRole('button', { name: 'Deschide calendarul' }));
    await user.click(screen.getByRole('button', { name: 'Luna următoare' }));
    expect(screen.getByText(/octombrie 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Luna precedentă' }));
    await user.click(screen.getByRole('button', { name: 'Luna precedentă' }));
    expect(screen.getByText(/august 2026/)).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<DatePicker value="2026-09-15" onChange={() => {}} ariaLabel="Data" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
