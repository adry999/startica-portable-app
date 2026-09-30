import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

describe('Tabs', () => {
  const options = [
    { value: 'backup', label: 'Backup' },
    { value: 'curs', label: 'Planuri și curs' },
    { value: 'branches', label: 'Filiale' },
  ];

  it('randează toate filele și marchează cea activă', () => {
    render(<Tabs options={options} value="curs" onChange={() => {}} ariaLabel="Subpagini" />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Planuri și curs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Backup' })).toHaveAttribute('aria-selected', 'false');
  });

  it('anunță schimbarea la clic pe altă filă', async () => {
    const onChange = vi.fn();
    render(<Tabs options={options} value="backup" onChange={onChange} ariaLabel="Subpagini" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Filiale' }));
    expect(onChange).toHaveBeenCalledWith('branches');
  });

  it('navighează cu săgețile stânga/dreapta între file', async () => {
    const onChange = vi.fn();
    render(<Tabs options={options} value="backup" onChange={onChange} ariaLabel="Subpagini" />);
    const user = userEvent.setup();
    screen.getByRole('tab', { name: 'Backup' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('curs');

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('backup');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Tabs options={options} value="backup" onChange={() => {}} ariaLabel="Subpagini" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
