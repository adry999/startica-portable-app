import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListToolbar } from './ListToolbar';

describe('ListToolbar', () => {
  it('randează căutarea și apelează onChange', async () => {
    const onChange = vi.fn();
    render(<ListToolbar search={{ value: '', onChange, ariaLabel: 'Caută', placeholder: 'Caută' }} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Caută' }), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('randează children și trailing', () => {
    render(
      <ListToolbar search={{ value: '', onChange: () => {}, ariaLabel: 'Caută' }} trailing="8 persoane">
        <button type="button">Funcții</button>
      </ListToolbar>,
    );
    expect(screen.getByRole('button', { name: 'Funcții' })).toBeInTheDocument();
    expect(screen.getByText('8 persoane')).toBeInTheDocument();
  });

  it('nu randează trailing când lipsește', () => {
    render(<ListToolbar search={{ value: '', onChange: () => {}, ariaLabel: 'Caută' }} />);
    expect(screen.queryByText(/persoane/)).not.toBeInTheDocument();
  });
});
