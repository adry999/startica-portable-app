import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveFilters } from './ActiveFilters';

describe('ActiveFilters', () => {
  it('arată un chip per filtru activ și cheamă onClear la clic', async () => {
    const onClear = vi.fn();
    render(<ActiveFilters filters={[{ key: 'method', label: 'Metodă: Cash', onClear }]} onReset={() => {}} />);
    const user = userEvent.setup();

    expect(screen.getByText('Metodă: Cash')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Metodă: Cash/ }));

    expect(onClear).toHaveBeenCalled();
  });

  it('cheamă onReset la clic pe „Șterge filtrele"', async () => {
    const onReset = vi.fn();
    render(<ActiveFilters filters={[{ key: 'a', label: 'A', onClear: () => {} }]} onReset={onReset} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }));

    expect(onReset).toHaveBeenCalled();
  });

  it('arată mai multe chip-uri, unul per filtru', () => {
    render(
      <ActiveFilters
        filters={[
          { key: 'a', label: 'Metodă: Cash', onClear: () => {} },
          { key: 'b', label: 'Grupa: Curcubeu', onClear: () => {} },
        ]}
        onReset={() => {}}
      />,
    );

    expect(screen.getByText('Metodă: Cash')).toBeInTheDocument();
    expect(screen.getByText('Grupa: Curcubeu')).toBeInTheDocument();
  });
});
