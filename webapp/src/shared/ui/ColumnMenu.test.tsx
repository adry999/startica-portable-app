import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ColumnMenu } from './ColumnMenu';

const COLUMNS = [
  { key: 'name', label: 'Nume', locked: true },
  { key: 'phone', label: 'Telefon' },
  { key: 'group', label: 'Grupă' },
];

describe('ColumnMenu', () => {
  it('deschide panoul cu coloanele la clic pe declanșator', async () => {
    const user = userEvent.setup();
    const { container } = render(<ColumnMenu columns={COLUMNS} visibleKeys={['name', 'phone']} onChange={() => {}} />);

    expect(container.querySelector('details')).not.toHaveAttribute('open');
    await user.click(screen.getByLabelText('Coloane'));

    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByText('Nume')).toBeInTheDocument();
    expect(screen.getByText('Telefon')).toBeInTheDocument();
    expect(screen.getByText('Grupă')).toBeInTheDocument();
  });

  it('bifează/debifează o coloană și apelează onChange cu lista actualizată', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColumnMenu columns={COLUMNS} visibleKeys={['name', 'phone']} onChange={onChange} />);

    await user.click(screen.getByLabelText('Coloane'));
    await user.click(screen.getByRole('checkbox', { name: 'Grupă' }));
    expect(onChange).toHaveBeenCalledWith(['name', 'phone', 'group']);

    await user.click(screen.getByRole('checkbox', { name: 'Telefon' }));
    expect(onChange).toHaveBeenCalledWith(['name']);
  });

  it('coloana `locked` apare bifată și dezactivată', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColumnMenu columns={COLUMNS} visibleKeys={['name']} onChange={onChange} />);

    await user.click(screen.getByLabelText('Coloane'));
    const nameCheckbox = screen.getByRole('checkbox', { name: 'Nume' });

    expect(nameCheckbox).toHaveAttribute('aria-checked', 'true');
    expect(nameCheckbox).toBeDisabled();

    await user.click(nameCheckbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<ColumnMenu columns={COLUMNS} visibleKeys={['name', 'phone']} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
