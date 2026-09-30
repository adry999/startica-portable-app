import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './MultiSelect';

const OPTIONS = [
  { value: 'a', label: 'Grupa Mari' },
  { value: 'b', label: 'Grupa Mici' },
  { value: 'c', label: 'Grupa Mijlocii' },
];

describe('MultiSelect', () => {
  it('arată placeholder cât nu e nimic selectat', () => {
    render(
      <MultiSelect ariaLabel="Grupe" placeholder="Alege grupe…" options={OPTIONS} selected={[]} onChange={() => {}} />,
    );
    expect(screen.getByPlaceholderText('Alege grupe…')).toBeInTheDocument();
  });

  it('arată un chip pentru fiecare valoare selectată', () => {
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a', 'b']} onChange={() => {}} />);
    expect(screen.getByText('Grupa Mari')).toBeInTheDocument();
    expect(screen.getByText('Grupa Mici')).toBeInTheDocument();
  });

  it('comprimă chip-urile peste `maxVisibleChips` într-un indicator „+N”', () => {
    render(
      <MultiSelect
        ariaLabel="Grupe"
        options={OPTIONS}
        selected={['a', 'b', 'c']}
        onChange={() => {}}
        maxVisibleChips={1}
      />,
    );
    expect(screen.getByText('Grupa Mari')).toBeInTheDocument();
    expect(screen.queryByText('Grupa Mici')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('clic pe × elimină chip-ul din selecție', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a', 'b']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Elimină Grupa Mari' }));

    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('focus pe casetă deschide panoul cu opțiunile rămase, nealese', async () => {
    const user = userEvent.setup();
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a']} onChange={() => {}} />);

    await user.click(screen.getByLabelText('Grupe'));

    expect(screen.getByRole('checkbox', { name: 'Grupa Mici' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Grupa Mijlocii' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Grupa Mari' })).not.toBeInTheDocument();
  });

  it('bifarea unei opțiuni din panou o adaugă la selecție', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a']} onChange={onChange} />);

    await user.click(screen.getByLabelText('Grupe'));
    await user.click(screen.getByRole('checkbox', { name: 'Grupa Mici' }));

    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('Backspace pe casetă goală elimină ultimul chip', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a', 'b']} onChange={onChange} />);

    screen.getByLabelText('Grupe').focus();
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('Backspace fără chip-uri nu apelează onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={[]} onChange={onChange} />);

    screen.getByLabelText('Grupe').focus();
    await user.keyboard('{Backspace}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <MultiSelect ariaLabel="Grupe" options={OPTIONS} selected={['a']} onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
