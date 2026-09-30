import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ProgressToast } from './ProgressToast';

describe('ProgressToast', () => {
  it('randează titlul și detaliul', () => {
    render(<ProgressToast title="Se exportă situația plăților…" detail="62 din 100 de copii" progress={62} />);
    expect(screen.getByText('Se exportă situația plăților…')).toBeInTheDocument();
    expect(screen.getByText('62 din 100 de copii')).toBeInTheDocument();
  });

  it('arată progresul primit pe bara de progres', () => {
    render(<ProgressToast title="Export" progress={40} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('fără progress, bara rămâne la 0%', () => {
    render(<ProgressToast title="Export" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('nu arată butonul de anulare fără onCancel', () => {
    render(<ProgressToast title="Export" />);
    expect(screen.queryByRole('button', { name: 'Anulează' })).not.toBeInTheDocument();
  });

  it('cheamă onCancel la clic pe butonul de anulare', async () => {
    const onCancel = vi.fn();
    render(<ProgressToast title="Export" progress={20} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <ProgressToast
        title="Se exportă situația plăților…"
        progress={62}
        detail="62 din 100 de copii"
        onCancel={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
