import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MonthPicker } from './MonthPicker';

describe('MonthPicker', () => {
  it('afișează luna și anul curente', () => {
    render(<MonthPicker value="2026-09" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Septembrie 2026' })).toBeInTheDocument();
  });

  it('săgeata dreapta trece la luna următoare', async () => {
    const onChange = vi.fn();
    render(<MonthPicker value="2026-09" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Luna următoare' }));
    expect(onChange).toHaveBeenCalledWith('2026-10');
  });

  it('săgeata dreapta trece anul înainte în decembrie', async () => {
    const onChange = vi.fn();
    render(<MonthPicker value="2026-12" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Luna următoare' }));
    expect(onChange).toHaveBeenCalledWith('2027-01');
  });

  it('săgeata stânga trece anul înapoi în ianuarie', async () => {
    const onChange = vi.fn();
    render(<MonthPicker value="2026-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Luna anterioară' }));
    expect(onChange).toHaveBeenCalledWith('2025-12');
  });

  it('deschide meniul cu grila de luni și selectează una', async () => {
    const onChange = vi.fn();
    render(<MonthPicker value="2026-09" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Septembrie 2026' }));
    expect(screen.getByRole('option', { name: 'Sep' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('option', { name: 'Dec' }));
    expect(onChange).toHaveBeenCalledWith('2026-12');
  });

  it('navigarea pe an din meniu nu schimbă luna selectată', async () => {
    render(<MonthPicker value="2026-09" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Septembrie 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anul următor' }));
    expect(screen.getByText('2027')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sep' })).toHaveAttribute('aria-selected', 'false');
  });

  it('se închide la Escape', async () => {
    render(<MonthPicker value="2026-09" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Septembrie 2026' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
