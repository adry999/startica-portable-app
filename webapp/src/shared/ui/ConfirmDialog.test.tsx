import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('cheamă onConfirm/onCancel la clic pe butoane', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Ștergi grupa?" description="Text" onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(onCancel).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmă' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('etichetele butoanelor sunt personalizabile', () => {
    render(
      <ConfirmDialog
        open
        title="Ștergi grupa?"
        confirmLabel="Șterge grupa"
        cancelLabel="Renunță"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Șterge grupa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renunță' })).toBeInTheDocument();
  });

  it('cât `confirming` e adevărat, butoanele sunt dezactivate și textul arată starea', () => {
    render(<ConfirmDialog open title="Ștergi grupa?" confirming onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Se procesează…').closest('button')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <ConfirmDialog
        open
        title="Ștergi grupa?"
        description="Acțiunea nu poate fi anulată."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
