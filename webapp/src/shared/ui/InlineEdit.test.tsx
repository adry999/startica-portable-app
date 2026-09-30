import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { InlineEdit } from './InlineEdit';

describe('InlineEdit', () => {
  it('randează valoarea ca text/buton în starea implicită', () => {
    render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ionescu Maria' })).toBeInTheDocument();
  });

  it('arată placeholder-ul când valoarea e goală', () => {
    render(<InlineEdit ariaLabel="Nume" value="" onSave={() => {}} placeholder="Fără nume" />);
    expect(screen.getByText('Fără nume')).toBeInTheDocument();
  });

  it('clic intră în modul de editare cu un input focusat', async () => {
    const user = userEvent.setup();
    render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Ionescu Maria' }));

    const input = screen.getByLabelText('Nume') as HTMLInputElement;
    expect(input).toHaveValue('Ionescu Maria');
    expect(input).toHaveFocus();
  });

  it('Enter salvează valoarea modificată, trimisă', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Ionescu Maria' }));
    const input = screen.getByLabelText('Nume');
    await user.clear(input);
    await user.type(input, '  Popescu Ion  {Enter}');

    expect(onSave).toHaveBeenCalledWith('Popescu Ion');
  });

  it('blur salvează, dar doar dacă valoarea s-a schimbat', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={onSave} />
        <button type="button">Altundeva</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Ionescu Maria' }));
    await user.click(screen.getByRole('button', { name: 'Altundeva' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('Escape revine la valoarea inițială fără să salveze', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Ionescu Maria' }));
    const input = screen.getByLabelText('Nume');
    await user.clear(input);
    await user.type(input, 'Alt text{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ionescu Maria' })).toBeInTheDocument();
  });

  it('disabled randează un span necliclabil', () => {
    render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} disabled />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Ionescu Maria')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<InlineEdit ariaLabel="Nume" value="Ionescu Maria" onSave={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
