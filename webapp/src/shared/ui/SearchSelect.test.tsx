import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchSelect } from './SearchSelect';

const OPTIONS = [
  { value: 'c1', label: 'Andrei Popescu' },
  { value: 'c2', label: 'Maria Ionescu' },
  { value: 'c3', label: 'Bianca Stan' },
];

describe('SearchSelect', () => {
  it('arată placeholder când nu e nimic selectat și deschide meniul la click', async () => {
    const onChange = vi.fn();
    render(<SearchSelect options={OPTIONS} value="" onChange={onChange} placeholder="Alege…" ariaLabel="Copii" />);

    expect(screen.getByText('Alege…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));

    expect(screen.getByRole('listbox', { name: 'Copii' })).toBeInTheDocument();
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
  });

  it('filtrează opțiunile după textul căutat', async () => {
    const onChange = vi.fn();
    render(<SearchSelect options={OPTIONS} value="" onChange={onChange} ariaLabel="Copii" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    await userEvent.type(screen.getByLabelText('Caută în Copii'), 'bianca');

    expect(screen.getByText('Bianca Stan')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
  });

  it('selectează o opțiune la click și închide meniul', async () => {
    const onChange = vi.fn();
    render(<SearchSelect options={OPTIONS} value="" onChange={onChange} ariaLabel="Copii" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    await userEvent.click(screen.getByText('Maria Ionescu'));

    expect(onChange).toHaveBeenCalledWith('c2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('arată eticheta opțiunii selectate pe trigger', () => {
    const onChange = vi.fn();
    render(<SearchSelect options={OPTIONS} value="c3" onChange={onChange} ariaLabel="Copii" />);

    expect(screen.getByRole('button', { name: 'Copii' })).toHaveTextContent('Bianca Stan');
  });

  it('arată emptyLabel când nu există rezultate', async () => {
    const onChange = vi.fn();
    render(<SearchSelect options={OPTIONS} value="" onChange={onChange} emptyLabel="Fără rezultate" ariaLabel="Copii" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    await userEvent.type(screen.getByLabelText('Caută în Copii'), 'zzz');

    expect(screen.getByText('Fără rezultate')).toBeInTheDocument();
  });
});
