import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneInput } from './PhoneInput';

describe('PhoneInput', () => {
  it('apelează onChange cu valoarea introdusă, cât timp se tastează', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} ariaLabel="Telefon" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Telefon'), '0');

    expect(onChange).toHaveBeenCalledWith('0');
  });

  it('nu arată niciun mesaj cât câmpul e gol', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.queryByText(/\d{3} \d{3} \d{3}/)).not.toBeInTheDocument();
    expect(screen.queryByText('Numărul nu e un mobil moldovenesc valid.')).not.toBeInTheDocument();
  });

  it('arată un E.164 salvat ca „069 123 456”, în câmp și sub el', () => {
    render(<PhoneInput value="+37369123456" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByLabelText('Telefon')).toHaveValue('069 123 456');
    expect(screen.getByText('069 123 456')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).not.toHaveAttribute('aria-invalid');
  });

  it('arată confirmarea „069 123 456” pentru un număr scris liber, fără „+”', () => {
    render(<PhoneInput value="069123456" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByText('069 123 456')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).not.toHaveAttribute('aria-invalid');
  });

  it('la focus, un E.164 salvat devine editabil ca cifrele cu care a fost scris', async () => {
    render(<PhoneInput value="+37369123456" onChange={() => {}} ariaLabel="Telefon" />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Telefon'));
    expect(screen.getByLabelText('Telefon')).toHaveValue('069123456');
  });

  it('arată „Număr incomplet” pentru un număr prea scurt, nu mesajul generic', () => {
    render(<PhoneInput value="123" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByText('Număr incomplet: 8 cifre după 0.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
  });

  it('arată mesajul generic pentru un prefix care nu e mobil moldovenesc', () => {
    render(<PhoneInput value="022123456" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByText('Numărul nu e un mobil moldovenesc valid.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
  });

  it('acceptă un „alt număr” cu prefix „+” care nu e moldovenesc, fără eroare', () => {
    render(<PhoneInput value="+40 721 000 000" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByLabelText('Telefon')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Numărul nu e un mobil moldovenesc valid.')).not.toBeInTheDocument();
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" disabled />);
    expect(screen.getByLabelText('Telefon')).toBeDisabled();
  });

  // F4 (FEEDBACK-01-10.md): fără autocompletare de browser.
  it('are autoComplete="off"', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('autocomplete', 'off');
  });

  describe('la blur, valoarea finală urcată prin onChange e E.164 (§10)', () => {
    it.each(['69123456', '069123456', '373 69123456', '0037369123456', '(+373) 69-12.34 56'])(
      '„%s” devine +37369123456',
      async raw => {
        const onChange = vi.fn();
        render(<PhoneInput value="" onChange={onChange} ariaLabel="Telefon" />);
        const user = userEvent.setup();
        const input = screen.getByLabelText('Telefon');

        await user.type(input, raw);
        await user.tab();

        expect(onChange).toHaveBeenLastCalledWith('+37369123456');
      },
    );

    it('un „alt număr” cu prefix „+” urcă exact cum a fost scris', async () => {
      const onChange = vi.fn();
      render(<PhoneInput value="" onChange={onChange} ariaLabel="Telefon" />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Telefon'), '+40721000000');
      await user.tab();

      expect(onChange).toHaveBeenLastCalledWith('+40721000000');
    });

    it('un număr incomplet/invalid urcă textul brut, nesalvat în tăcere', async () => {
      const onChange = vi.fn();
      render(<PhoneInput value="" onChange={onChange} ariaLabel="Telefon" />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Telefon'), '123');
      await user.tab();

      expect(onChange).toHaveBeenLastCalledWith('123');
    });

    it('golirea câmpului urcă text gol', async () => {
      const onChange = vi.fn();
      render(<PhoneInput value="069123456" onChange={onChange} ariaLabel="Telefon" />);
      const user = userEvent.setup();

      await user.clear(screen.getByLabelText('Telefon'));
      await user.tab();

      expect(onChange).toHaveBeenLastCalledWith('');
    });
  });
});
