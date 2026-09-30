import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TagInput } from './TagInput';

describe('TagInput', () => {
  it('arată fiecare tag existent ca chip', () => {
    render(<TagInput ariaLabel="Alergii" tags={['Lactate', 'Nuci']} onChange={() => {}} />);
    expect(screen.getByText('Lactate')).toBeInTheDocument();
    expect(screen.getByText('Nuci')).toBeInTheDocument();
  });

  it('Enter adaugă textul curent ca tag nou și golește câmpul', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={['Lactate']} onChange={onChange} />);

    const input = screen.getByLabelText('Alergii');
    await user.type(input, 'Ouă{Enter}');

    expect(onChange).toHaveBeenCalledWith(['Lactate', 'Ouă']);
    expect(input).toHaveValue('');
  });

  it('virgula confirmă tag-ul curent, la fel ca Enter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Alergii'), 'Polen,');

    expect(onChange).toHaveBeenCalledWith(['Polen']);
  });

  it('nu adaugă un tag gol sau deja existent', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={['Nuci']} onChange={onChange} />);

    const input = screen.getByLabelText('Alergii');
    await user.type(input, '{Enter}');
    await user.type(input, 'Nuci{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clic pe × elimină tag-ul respectiv', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={['Lactate', 'Nuci']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Elimină Lactate' }));

    expect(onChange).toHaveBeenCalledWith(['Nuci']);
  });

  it('Backspace pe câmpul gol elimină ultimul tag', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={['Lactate', 'Nuci']} onChange={onChange} />);

    await user.type(screen.getByLabelText('Alergii'), '{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['Lactate']);
  });

  it('Backspace cu text în câmp nu elimină tag-uri', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput ariaLabel="Alergii" tags={['Lactate']} onChange={onChange} />);

    await user.type(screen.getByLabelText('Alergii'), 'a{Backspace}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<TagInput ariaLabel="Alergii" tags={['Lactate', 'Nuci']} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
