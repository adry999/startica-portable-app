import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MonthInput } from './MonthInput';

describe('MonthInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<MonthInput value="" onChange={onChange} ariaLabel="Luna" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Luna'), '2026-09');

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('Luna')).toHaveAttribute('type', 'month');
  });

  it('arată textul opțional `trailing`', () => {
    render(<MonthInput value="2026-09" onChange={() => {}} ariaLabel="Perioada" trailing="luna curentă" />);
    expect(screen.getByText('luna curentă')).toBeInTheDocument();
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<MonthInput value="" onChange={() => {}} ariaLabel="Luna" invalid />);
    expect(screen.getByLabelText('Luna')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<MonthInput value="" onChange={() => {}} ariaLabel="Luna" disabled />);
    expect(screen.getByLabelText('Luna')).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<MonthInput value="2026-09" onChange={() => {}} ariaLabel="Luna" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
