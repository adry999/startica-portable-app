import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { FilterMenu } from './FilterMenu';

const OPTIONS = [
  { value: 'cash', label: 'Cash', count: 12 },
  { value: 'card', label: 'Card', count: 4 },
];

describe('FilterMenu', () => {
  it('arată eticheta și numărul de opțiuni selectate', () => {
    render(<FilterMenu label="Metodă" options={OPTIONS} selected={['cash']} onChange={() => {}} />);
    expect(screen.getByText('Metodă')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('deschide meniul și arată opțiunile la clic pe declanșator', async () => {
    const user = userEvent.setup();
    render(<FilterMenu label="Metodă" options={OPTIONS} selected={[]} onChange={() => {}} />);

    expect(screen.queryByText('Card')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Metodă' }));

    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('bifarea unei opțiuni adaugă valoarea imediat, fără buton „Aplică”', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterMenu label="Metodă" options={OPTIONS} selected={['cash']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Metodă/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Card' }));

    expect(onChange).toHaveBeenCalledWith(['cash', 'card']);
    expect(screen.queryByRole('button', { name: 'Aplică' })).not.toBeInTheDocument();
  });

  it('debifarea unei opțiuni elimină valoarea din selecție', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterMenu label="Metodă" options={OPTIONS} selected={['cash', 'card']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Metodă/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Cash' }));

    expect(onChange).toHaveBeenCalledWith(['card']);
  });

  it('„Șterge filtrele” apare doar cât e activă o selecție și golește selecția', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<FilterMenu label="Metodă" options={OPTIONS} selected={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Metodă' }));
    expect(screen.queryByText('Șterge filtrele')).not.toBeInTheDocument();

    rerender(<FilterMenu label="Metodă" options={OPTIONS} selected={['cash']} onChange={onChange} />);
    await user.click(screen.getByText('Șterge filtrele'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('arată schelet în locul contorului cât `countsLoading` e adevărat, opțiunile rămân clicabile', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterMenu label="Metodă" options={OPTIONS} selected={[]} onChange={onChange} countsLoading />);

    await user.click(screen.getByRole('button', { name: 'Metodă' }));

    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.queryByText('4')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Cash' }));
    expect(onChange).toHaveBeenCalledWith(['cash']);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <FilterMenu label="Metodă" options={OPTIONS} selected={['cash']} onChange={() => {}} ariaLabel="Filtru metodă" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
