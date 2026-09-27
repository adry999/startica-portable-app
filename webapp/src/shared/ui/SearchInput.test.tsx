import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('randează valoarea și eticheta primite', () => {
    render(<SearchInput value="Maria" onChange={vi.fn()} ariaLabel="Caută copil" />);
    expect(screen.getByRole('searchbox', { name: 'Caută copil' })).toHaveValue('Maria');
  });

  it('trimite textul introdus prin onChange', async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} ariaLabel="Caută" placeholder="Caută…" />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Caută' }), 'I');
    expect(onChange).toHaveBeenCalledWith('I');
  });
});
