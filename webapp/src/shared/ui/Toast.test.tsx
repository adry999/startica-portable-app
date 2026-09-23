import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function ShowToastButton({ actionLabel, onAction }: { actionLabel?: string; onAction?: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show({ message: '2 achitări arhivate', actionLabel, onAction })}>
      Arhivează
    </button>
  );
}

describe('Toast', () => {
  it('afișează mesajul după show()', async () => {
    render(
      <ToastProvider>
        <ShowToastButton />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Arhivează' }));
    expect(screen.getByText('2 achitări arhivate')).toBeInTheDocument();
  });

  it('la click pe acțiune, o execută și ascunde toast-ul', async () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <ShowToastButton actionLabel="Anulează" onAction={onAction} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Arhivează' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('2 achitări arhivate')).not.toBeInTheDocument();
  });

  it('dispare singur după 6 secunde', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ShowToastButton />
        </ToastProvider>,
      );
      // fireEvent, nu userEvent: userEvent așteaptă pe timere reale între pași,
      // care nu mai avansează cât timp fake timers sunt active.
      fireEvent.click(screen.getByRole('button', { name: 'Arhivează' }));
      expect(screen.getByText('2 achitări arhivate')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.queryByText('2 achitări arhivate')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('aruncă eroare clară dacă useToast e folosit fără provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ShowToastButton />)).toThrow('useToast trebuie folosit în interiorul ToastProvider');
    consoleError.mockRestore();
  });
});
