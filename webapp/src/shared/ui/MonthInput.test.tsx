import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MonthInput } from './MonthInput';

describe('MonthInput', () => {
  it('§3 (PROMPT-11 F17): alegerea unei luni din grilă apelează onChange și închide popover-ul', async () => {
    const onChange = vi.fn();
    render(<MonthInput value="2026-09" onChange={onChange} ariaLabel="Luna" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Luna' }));
    await user.click(screen.getByRole('gridcell', { name: 'Noiembrie 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-11');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('fără valoare, butonul arată un indiciu neutru', () => {
    render(<MonthInput value="" onChange={vi.fn()} ariaLabel="Luna" />);
    expect(screen.getByRole('button', { name: 'Luna' })).toHaveTextContent('Alege luna');
  });

  it('cu valoare, butonul arată luna și anul complet', () => {
    render(<MonthInput value="2026-09" onChange={vi.fn()} ariaLabel="Luna" />);
    expect(screen.getByRole('button', { name: 'Luna' })).toHaveTextContent('Septembrie 2026');
  });

  it('Escape închide popover-ul și readuce focusul pe buton', async () => {
    render(<MonthInput value="2026-09" onChange={vi.fn()} ariaLabel="Luna" />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Luna' });

    await user.click(trigger);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('săgețile navighează grila (3 coloane) fără s-o închidă', async () => {
    render(<MonthInput value="2026-09" onChange={vi.fn()} ariaLabel="Luna" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Luna' }));

    const ianuarie = screen.getByRole('gridcell', { name: 'Ianuarie 2026' });
    ianuarie.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('gridcell', { name: 'Februarie 2026' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: 'Mai 2026' })).toHaveFocus();
  });

  it('„Luna curentă” alege direct luna de azi', async () => {
    const onChange = vi.fn();
    render(<MonthInput value="2020-01" onChange={onChange} ariaLabel="Luna" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Luna' }));
    await user.click(screen.getByRole('button', { name: 'Luna curentă' }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it('§3: lunile din `markers` arată un punct de stare, cele din `isDisabled`/`min`/`max` sunt dezactivate', async () => {
    render(
      <MonthInput
        value="2026-06"
        onChange={vi.fn()}
        ariaLabel="Luna"
        min="2026-03"
        isDisabled={month => month === '2026-08'}
        markers={{ '2026-04': 'paid', '2026-05': 'debt' }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Luna' }));

    expect(screen.getByRole('gridcell', { name: 'Ianuarie 2026' })).toBeDisabled();
    expect(screen.getByRole('gridcell', { name: 'August 2026' })).toBeDisabled();
    expect(screen.getByRole('gridcell', { name: 'Martie 2026' })).not.toBeDisabled();
    expect(screen.getByRole('gridcell', { name: 'Aprilie 2026' }).className).toMatch(/paid/);
    expect(screen.getByRole('gridcell', { name: 'Mai 2026' }).className).toMatch(/debt/);
  });

  it('arată textul opțional `trailing`', () => {
    render(<MonthInput value="2026-09" onChange={() => {}} ariaLabel="Perioada" trailing="luna curentă" />);
    expect(screen.getByText('luna curentă')).toBeInTheDocument();
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<MonthInput value="" onChange={() => {}} ariaLabel="Luna" invalid />);
    expect(screen.getByRole('button', { name: 'Luna' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<MonthInput value="" onChange={() => {}} ariaLabel="Luna" disabled />);
    expect(screen.getByRole('button', { name: 'Luna' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<MonthInput value="2026-09" onChange={() => {}} ariaLabel="Luna" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
