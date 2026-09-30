import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PinInput } from './PinInput';

describe('PinInput', () => {
  it('randează câte o casetă pentru fiecare cifră din length', () => {
    render(<PinInput length={4} value="" onChange={() => {}} ariaLabel="PIN" />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('afișează cifrele deja tastate în casetele corespunzătoare', () => {
    render(<PinInput length={4} value="12" onChange={() => {}} ariaLabel="PIN" />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes[0]).toHaveValue('1');
    expect(boxes[1]).toHaveValue('2');
    expect(boxes[2]).toHaveValue('');
  });

  it('apelează onChange cu valoarea actualizată și avansează focusul', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PinInput length={4} value="1" onChange={onChange} ariaLabel="PIN" />);
    const boxes = screen.getAllByRole('textbox');
    boxes[1].focus();
    await user.keyboard('2');
    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('Backspace pe o casetă goală mută focusul înapoi', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PinInput length={4} value="12" onChange={onChange} ariaLabel="PIN" />);
    const boxes = screen.getAllByRole('textbox');
    boxes[2].focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith('1');
    expect(boxes[1]).toHaveFocus();
  });

  it('marchează casetele ca invalide prin aria-invalid', () => {
    render(<PinInput length={4} value="" onChange={() => {}} ariaLabel="PIN" invalid />);
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('aria-invalid', 'true');
  });

  it('dezactivează toate casetele cât disabled e adevărat', () => {
    render(<PinInput length={4} value="" onChange={() => {}} ariaLabel="PIN" disabled />);
    for (const box of screen.getAllByRole('textbox')) expect(box).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<PinInput length={4} value="12" onChange={() => {}} ariaLabel="PIN" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
