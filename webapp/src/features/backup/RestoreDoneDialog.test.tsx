import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RestoreDoneDialog } from './RestoreDoneDialog';

describe('RestoreDoneDialog', () => {
  it('nu are buton ×, iar Escape nu îl închide (46d)', async () => {
    const user = userEvent.setup();
    render(<RestoreDoneDialog open branchCount={2} onReload={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Închide' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('arată numărul de filiale și numărătoarea inversă', () => {
    render(<RestoreDoneDialog open branchCount={2} onReload={() => {}} />);
    expect(screen.getByText(/Am restaurat 2 filiale și baza Comun/)).toBeInTheDocument();
    expect(screen.getByText('Aplicația se reîncarcă în 5 s ca să citească filialele noi.')).toBeInTheDocument();
  });

  it('o singură filială primește forma de singular', () => {
    render(<RestoreDoneDialog open branchCount={1} onReload={() => {}} />);
    expect(screen.getByText(/Am restaurat 1 filială și baza Comun/)).toBeInTheDocument();
  });

  it('reîncarcă automat după 5 secunde', () => {
    vi.useFakeTimers();
    try {
      const onReload = vi.fn();
      render(<RestoreDoneDialog open branchCount={2} onReload={onReload} />);
      expect(onReload).not.toHaveBeenCalled();
      for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(1000));
      expect(onReload).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('„Reîncarcă acum” cheamă onReload imediat', () => {
    const onReload = vi.fn();
    render(<RestoreDoneDialog open branchCount={2} onReload={onReload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reîncarcă acum' }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<RestoreDoneDialog open branchCount={2} onReload={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
