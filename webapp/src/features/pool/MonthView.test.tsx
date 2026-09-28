import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@shared/ui';
import { MonthView } from './MonthView';

describe('MonthView', () => {
  it('Închide luna e dezactivat cât există ședințe nemarcate și arată motivul', () => {
    render(
      <ToastProvider>
        <MonthView
          month="2026-09"
          children={[]}
          coaches={[]}
          closing={null}
          unmarked={3}
          closingBusy={false}
          closeError=""
          onCloseMonth={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Închide luna' })).toBeDisabled();
    expect(screen.getByText(/3 ședințe nemarcate/)).toBeInTheDocument();
  });

  it('cu toate ședințele marcate, butonul e activ', () => {
    render(
      <ToastProvider>
        <MonthView
          month="2026-09"
          children={[]}
          coaches={[]}
          closing={null}
          unmarked={0}
          closingBusy={false}
          closeError=""
          onCloseMonth={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Închide luna' })).toBeEnabled();
  });
});
