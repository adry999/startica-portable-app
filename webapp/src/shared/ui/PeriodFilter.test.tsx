import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeriodFilter, periodPresetBounds, type PeriodPreset } from './PeriodFilter';

const TODAY = '2026-10-02'; // vineri, octombrie 2026

describe('periodPresetBounds', () => {
  it('luna: prima și ultima zi a lunii curente', () => {
    expect(periodPresetBounds('luna', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('luna-trecuta: prima și ultima zi a lunii anterioare, cu trecere de an', () => {
    expect(periodPresetBounds('luna-trecuta', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('30z: ultimele 30 de zile, inclusiv azi', () => {
    expect(periodPresetBounds('30z', TODAY)).toEqual({ from: '2026-09-03', to: '2026-10-02' });
  });

  it('an-scolar: 1 septembrie – 31 august, cu trecere de an', () => {
    expect(periodPresetBounds('an-scolar', TODAY)).toEqual({ from: '2026-09-01', to: '2027-08-31' });
    expect(periodPresetBounds('an-scolar', '2026-03-10')).toEqual({ from: '2025-09-01', to: '2026-08-31' });
  });

  it('tot și interval: fără limite calculate', () => {
    expect(periodPresetBounds('tot', TODAY)).toEqual({ from: '', to: '' });
    expect(periodPresetBounds('interval', TODAY)).toEqual({ from: '', to: '' });
  });
});

function renderFilter(overrides: Partial<React.ComponentProps<typeof PeriodFilter>> = {}) {
  const onPresetChange = vi.fn();
  const onFromChange = vi.fn();
  const onToChange = vi.fn();
  render(
    <PeriodFilter
      preset="tot"
      from=""
      to=""
      onPresetChange={onPresetChange}
      onFromChange={onFromChange}
      onToChange={onToChange}
      {...overrides}
    />,
  );
  return { onPresetChange, onFromChange, onToChange };
}

/** Variantă cu stare reală (ca un apelant adevărat) — pentru cazurile unde alegerea unei
 * presetări trebuie să se reflecte înapoi în randare (ex. apariția `DateInput`-urilor la „interval”). */
function renderControlledFilter(initial: { preset: PeriodPreset; from: string; to: string }) {
  const onPresetChange = vi.fn();
  const onFromChange = vi.fn();
  const onToChange = vi.fn();

  function Wrapper() {
    const [state, setState] = useState(initial);
    return (
      <PeriodFilter
        preset={state.preset}
        from={state.from}
        to={state.to}
        onPresetChange={preset => {
          onPresetChange(preset);
          setState(current => ({ ...current, preset }));
        }}
        onFromChange={from => {
          onFromChange(from);
          setState(current => ({ ...current, from }));
        }}
        onToChange={to => {
          onToChange(to);
          setState(current => ({ ...current, to }));
        }}
      />
    );
  }

  render(<Wrapper />);
  return { onPresetChange, onFromChange, onToChange };
}

describe('PeriodFilter', () => {
  it('afișează eticheta presetării curente pe declanșator', () => {
    renderFilter({ preset: 'luna' });
    expect(screen.getByRole('button', { name: /Perioadă: Luna aceasta/ })).toBeInTheDocument();
  });

  it('deschide meniul cu cele 6 presetări la clic', () => {
    renderFilter();
    fireEvent.click(screen.getByRole('button', { name: /Perioadă: Tot/ }));
    expect(screen.getByRole('menuitemradio', { name: 'Luna aceasta' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Luna trecută' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Ultimele 30 de zile' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Anul școlar curent' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Tot' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Interval personalizat' })).toBeInTheDocument();
  });

  it('alegerea unei presetări calculate apelează onPresetChange + onFromChange/onToChange și închide meniul', () => {
    const { onPresetChange, onFromChange, onToChange } = renderFilter();
    fireEvent.click(screen.getByRole('button', { name: /Perioadă: Tot/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Tot' }));

    expect(onPresetChange).toHaveBeenCalledWith('tot');
    expect(onFromChange).toHaveBeenCalledWith('');
    expect(onToChange).toHaveBeenCalledWith('');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('alegerea „Interval personalizat” nu suprascrie from/to și arată cele 2 DateInput', () => {
    const { onPresetChange, onFromChange, onToChange } = renderControlledFilter({
      preset: 'tot',
      from: '',
      to: '',
    });
    fireEvent.click(screen.getByRole('button', { name: /Perioadă: Tot/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Interval personalizat' }));

    expect(onPresetChange).toHaveBeenCalledWith('interval');
    expect(onFromChange).not.toHaveBeenCalled();
    expect(onToChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Perioadă de la')).toBeInTheDocument();
    expect(screen.getByLabelText('Perioadă până la')).toBeInTheDocument();
  });

  it('nu arată DateInput pentru altă presetare decât interval', () => {
    renderFilter({ preset: 'luna' });
    fireEvent.click(screen.getByRole('button', { name: /Perioadă: Luna aceasta/ }));
    expect(screen.queryByLabelText('Perioadă de la')).not.toBeInTheDocument();
  });

  it('modifică from/to din DateInput la interval', () => {
    const { onFromChange, onToChange } = renderFilter({ preset: 'interval', from: '2026-01-01', to: '2026-01-31' });
    fireEvent.click(screen.getByRole('button', { name: /Perioadă: Interval personalizat/ }));

    fireEvent.change(screen.getByLabelText('Perioadă de la'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Perioadă până la'), { target: { value: '2026-02-28' } });

    expect(onFromChange).toHaveBeenCalledWith('2026-02-01');
    expect(onToChange).toHaveBeenCalledWith('2026-02-28');
  });
});
