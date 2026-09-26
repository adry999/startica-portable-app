import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VisitFormDrawer } from './VisitFormDrawer';
import type { Visit } from '@contracts/record-types.mjs';

function noShowVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'VIZ-1',
    name: 'Andrei Popescu',
    parent: 'Maria Popescu',
    phone: '0722000001',
    date: '2026-09-20',
    time: '10:00',
    status: 'Neprezentată',
    statusChangedAt: '2026-09-20T10:00:00.000Z',
    history: [],
    desiredGroupId: null,
    childId: '',
    ...overrides,
  };
}

describe('VisitFormDrawer', () => {
  it('statutul corectabil exclude Înscris, dar include Programată — chiar și pentru o vizită deja Neprezentată', () => {
    render(<VisitFormDrawer target={noShowVisit()} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);

    const select = screen.getByLabelText('Statut') as HTMLSelectElement;
    const optionLabels = [...select.options].map(option => option.textContent);
    expect(optionLabels).toEqual(['Programată', 'Efectuată', 'Neprezentată', 'A renunțat']);
  });

  it('reprogramarea (schimbarea datei) resetează Statutul afișat la Programată, nu re-aplică tăcut vechiul statut', async () => {
    const onSubmit = vi.fn();
    render(<VisitFormDrawer target={noShowVisit()} groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);
    const user = userEvent.setup();

    const dateInput = screen.getByLabelText('Data vizitei');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-09-27');

    expect((screen.getByLabelText('Statut') as HTMLSelectElement).value).toBe('Programată');

    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-27', status: 'Programată' }));
  });

  it('dropdown-ul Statut oferă o singură opțiune (Înscris) când vizita e deja înscrisă', () => {
    render(
      <VisitFormDrawer
        target={noShowVisit({ status: 'Înscris', childId: 'CH-1' })}
        groups={[]}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const select = screen.getByLabelText('Statut') as HTMLSelectElement;
    expect([...select.options].map(option => option.textContent)).toEqual(['S-a înscris']);
  });
});
