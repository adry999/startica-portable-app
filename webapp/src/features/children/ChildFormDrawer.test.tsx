import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { ChildFormDrawer } from './ChildFormDrawer';
import type { ChildRow } from './useChildren';
import type { Group } from '@contracts/record-types.mjs';

// Indiciul „Niciun plan definit” (3 · Contract) randează un <Link> — are nevoie de context de router.
function renderDrawer(ui: ReactElement) {
  return render(ui, { wrapper: MemoryRouter });
}

function row(overrides: Partial<ChildRow>): ChildRow {
  return {
    id: 'C-1',
    name: 'Copil',
    contractLabel: '',
    parent: '',
    phone: '',
    groupId: null,
    groupName: '',
    archived: false,
    status: 'Activ',
    dueDay: 10,
    dueDateLabel: '',
    payment: { tone: 'neutral', label: '' },
    child: {} as ChildRow['child'],
    ...overrides,
  };
}

describe('ChildFormDrawer', () => {
  it('nu randează nimic când target este null', () => {
    renderDrawer(<ChildFormDrawer target={null} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arată câmpurile și butonul de salvare pentru un copil nou', () => {
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByLabelText('Nume')[0]).toBeInTheDocument();
    expect(screen.getByLabelText('Prenume')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează copilul' })).toBeInTheDocument();
  });

  it('F3 (FEEDBACK-01-10.md): „Copil nou” arată „5 · Alte date” pliat, dar nu secțiunea 6 (doar la editare)', () => {
    const { unmount } = renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('5 · Alte date')).toBeInTheDocument();
    expect(screen.getByLabelText('IDNP').closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByLabelText('Adresă')).toBeInTheDocument();
    expect(screen.queryByText('6 · Istoric (avansat)')).not.toBeInTheDocument();
    unmount();

    const child = { id: 'C-1', name: 'Ana', parent: 'Maria' } as unknown as import('@contracts/record-types.mjs').Child;
    renderDrawer(<ChildFormDrawer target={child} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('5 · Alte date')).toBeInTheDocument();
    expect(screen.getByText('6 · Istoric (avansat)')).toBeInTheDocument();
  });

  it('§1 (PROMPT-11): fără niciun plan definit, arată EmptyState cu buton spre Planuri și curs', async () => {
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(
      await screen.findByText(
        /Nu sunt planuri setate pentru .*Adaugă planurile o dată și apoi alegi planul aici\. Până atunci, scrie taxa manual\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setează planurile' })).toBeInTheDocument();
  });

  it('trimite valorile completate la click pe Salvează', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Popescu');
    await userEvent.type(screen.getByLabelText('Prenume'), 'Ana');
    await userEvent.type(screen.getAllByLabelText('Nume')[1], 'Maria Popescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Popescu Ana', firstName: 'Ana', lastName: 'Popescu' }),
    );
  });

  it('trimite formularul la submit (echivalent cu Enter într-un câmp)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderDrawer(
      <ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Popescu');
    await userEvent.type(screen.getByLabelText('Prenume'), 'Ana');
    await userEvent.type(screen.getAllByLabelText('Nume')[1], 'Maria Popescu');
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Popescu Ana' }));
  });

  it('apelează onSubmit o singură dată la dublu-click rapid pe Salvează', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Popescu');
    await userEvent.type(screen.getByLabelText('Prenume'), 'Ana');
    await userEvent.type(screen.getAllByLabelText('Nume')[1], 'Maria Popescu');
    const saveButton = screen.getByRole('button', { name: 'Salvează copilul' });

    await userEvent.click(saveButton);
    await userEvent.click(saveButton);
    resolveSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('formularul devine „nesalvat” după prima modificare și save() întoarce true la salvare reușită', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    expect(readDirtyForms()).toEqual([]);

    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Popescu');
    await userEvent.type(screen.getByLabelText('Prenume'), 'Ana');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o fișă de copil');

    await expect(dirtyForm.save()).resolves.toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('editarea unei fișe vechi (fără firstName/lastName) nu cere Nume/Prenume și păstrează name', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const child = {
      id: 'C-1',
      name: 'Nume Vechi',
      parent: 'Maria',
    } as unknown as import('@contracts/record-types.mjs').Child;
    renderDrawer(<ChildFormDrawer target={child} groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    expect(screen.getAllByLabelText('Nume')[0]).toHaveValue('');
    expect(screen.getByLabelText('Prenume')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nume Vechi', firstName: '', lastName: '' }));
  });

  it('IDNP acceptă doar cifre, limitat la 13 (secțiunea „Alte date”, la editare)', async () => {
    const child = { id: 'C-1', name: 'Ana', parent: 'Maria' } as unknown as import('@contracts/record-types.mjs').Child;
    renderDrawer(<ChildFormDrawer target={child} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByText('5 · Alte date'));
    const idnpInput = screen.getByLabelText('IDNP');
    await userEvent.type(idnpInput, 'ab123456789012345cd');
    expect(idnpInput).toHaveValue('1234567890123');
  });

  it('15a: chip-ul de grupă arată locurile libere și selectează grupa la click', async () => {
    const groups: Group[] = [{ id: 'G-1', name: 'Fluturași', capacity: 3, order: 1 }];
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDrawer(
      <ChildFormDrawer
        target="new"
        groups={groups}
        allChildren={[row({ id: 'C-2', groupId: 'G-1' })]}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    const chip = screen.getByRole('radio', { name: /Fluturași/ });
    expect(chip).toHaveTextContent('Fluturași · 1/3');

    await userEvent.click(chip);
    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Popescu');
    await userEvent.type(screen.getByLabelText('Prenume'), 'Ana');
    await userEvent.type(screen.getAllByLabelText('Nume')[1], 'Maria Popescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'G-1' }));
  });

  it('15a: nu numără copilul editat la locurile ocupate din grupa lui curentă', () => {
    const groups: Group[] = [{ id: 'G-1', name: 'Fluturași', capacity: 2, order: 1 }];
    const child = { id: 'C-1', name: 'Ana', groupId: 'G-1' } as unknown as import('@contracts/record-types.mjs').Child;
    renderDrawer(
      <ChildFormDrawer
        target={child}
        groups={groups}
        allChildren={[row({ id: 'C-1', groupId: 'G-1' })]}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: /Fluturași/ })).toHaveTextContent('Fluturași · 0/2');
  });

  it('F2 (FEEDBACK-01-10.md): grupa plină rămâne selectabilă și arată nota de avertizare', async () => {
    const groups: Group[] = [{ id: 'G-1', name: 'Fluturași', capacity: 1, order: 1 }];
    renderDrawer(
      <ChildFormDrawer
        target="new"
        groups={groups}
        allChildren={[row({ id: 'C-2', groupId: 'G-1' })]}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const chip = screen.getByRole('radio', { name: /Fluturași/ });
    expect(chip).toHaveTextContent('Fluturași · 1/1');
    expect(screen.queryByText(/e plină/)).not.toBeInTheDocument();

    await userEvent.click(chip);
    expect(chip).not.toBeDisabled();
    expect(chip).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Fluturași e plină (1/1). Poți salva oricum.')).toBeInTheDocument();
  });

  it('§1 (PROMPT-11): la alegerea unui preset, arată confirmarea taxei lunare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/plan-presets' ? [{ id: 'P-1', name: 'Standard', priceEur: 150 }] : {}),
      })),
    );
    renderDrawer(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);

    const card = await screen.findByRole('radio', { name: /Standard/ });
    await userEvent.click(card);

    expect(
      screen.getByText((_, element) => element?.textContent === 'Taxa lunară = prețul planului: Standard · 150 €'),
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('15a: arată grupele compatibile cu vârsta calculată din data nașterii', async () => {
    const groups: Group[] = [
      { id: 'G-1', name: 'Fluturași', capacity: null, ageMinYears: 3, ageMaxYears: 4, order: 1 },
    ];
    renderDrawer(<ChildFormDrawer target="new" groups={groups} onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByText(/se potrivește în grupele/)).not.toBeInTheDocument();

    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    await userEvent.type(screen.getByLabelText(/Data nașterii/), fourYearsAgo.toISOString().slice(0, 10));

    expect(screen.getByText(/se potrivește în grupele/)).toBeInTheDocument();
    expect(screen.getAllByText('Fluturași').length).toBeGreaterThanOrEqual(1);
  });
});
