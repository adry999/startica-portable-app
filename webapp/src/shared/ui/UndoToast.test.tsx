import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UndoToastProvider, useUndoToast } from './UndoToast';

function ShowUndoButton({ onUndo }: { onUndo: () => Promise<void> }) {
  const undoToast = useUndoToast();
  return (
    <button
      type="button"
      onClick={() => undoToast.show({ title: 'Cheltuială adăugată', detail: '150 lei · Alimentație', onUndo })}
    >
      Adaugă
    </button>
  );
}

describe('UndoToast (40b)', () => {
  it('afișează titlul, detaliul și butonul „Anulează · 10” după show()', async () => {
    render(
      <UndoToastProvider>
        <ShowUndoButton onUndo={vi.fn().mockResolvedValue(undefined)} />
      </UndoToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }));

    expect(screen.getByText('Cheltuială adăugată')).toBeInTheDocument();
    expect(screen.getByText('150 lei · Alimentație')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anulează · 10' })).toBeInTheDocument();
  });

  it('numărătoarea scade o dată pe secundă și toast-ul dispare singur la 0 (10s)', () => {
    vi.useFakeTimers();
    try {
      render(
        <UndoToastProvider>
          <ShowUndoButton onUndo={vi.fn().mockResolvedValue(undefined)} />
        </UndoToastProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
      expect(screen.getByRole('button', { name: 'Anulează · 10' })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole('button', { name: 'Anulează · 7' })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(7000);
      });
      expect(screen.queryByText('Cheltuială adăugată')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('la click pe „Anulează · N” cheamă onUndo și ascunde toast-ul la succes', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    render(
      <UndoToastProvider>
        <ShowUndoButton onUndo={onUndo} />
      </UndoToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    await userEvent.click(screen.getByRole('button', { name: /Anulează · \d+/ }));

    expect(onUndo).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText('Cheltuială adăugată')).not.toBeInTheDocument());
  });

  it('dacă onUndo respinge (ex. „S-a modificat între timp.”), arată mesajul în locul detaliului, fără buton', async () => {
    const onUndo = vi.fn().mockRejectedValue(new Error('S-a modificat între timp.'));
    render(
      <UndoToastProvider>
        <ShowUndoButton onUndo={onUndo} />
      </UndoToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    await userEvent.click(screen.getByRole('button', { name: /Anulează · \d+/ }));

    expect(await screen.findByText('S-a modificat între timp.')).toBeInTheDocument();
    expect(screen.queryByText('150 lei · Alimentație')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Anulează/ })).not.toBeInTheDocument();
  });

  it('un al doilea show() înlocuiește toast-ul activ (un singur toast, jos-centru)', async () => {
    function TwoButtons() {
      const undoToast = useUndoToast();
      return (
        <>
          <button type="button" onClick={() => undoToast.show({ title: 'Prima', onUndo: vi.fn() })}>
            Primul
          </button>
          <button type="button" onClick={() => undoToast.show({ title: 'A doua', onUndo: vi.fn() })}>
            Al doilea
          </button>
        </>
      );
    }
    render(
      <UndoToastProvider>
        <TwoButtons />
      </UndoToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Primul' }));
    expect(screen.getByText('Prima')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Al doilea' }));
    expect(screen.queryByText('Prima')).not.toBeInTheDocument();
    expect(screen.getByText('A doua')).toBeInTheDocument();
  });

  it('aruncă eroare clară dacă useUndoToast e folosit fără provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ShowUndoButton onUndo={vi.fn()} />)).toThrow(
      'useUndoToast trebuie folosit în interiorul UndoToastProvider',
    );
    consoleError.mockRestore();
  });
});
