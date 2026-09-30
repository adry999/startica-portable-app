import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  it('titlul include numele formularului', () => {
    render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        onDiscard={() => {}}
        onStay={() => {}}
        onSaveAndContinue={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din copilul nou?' })).toBeInTheDocument();
  });

  it('arată câmpurile modificate când sunt date', () => {
    render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        changedFields={['nume', 'telefon']}
        onDiscard={() => {}}
        onStay={() => {}}
        onSaveAndContinue={() => {}}
      />,
    );
    expect(screen.getByText('Câmpuri modificate: nume, telefon.')).toBeInTheDocument();
  });

  it('nu arată lista de câmpuri când lipsesc', () => {
    render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        onDiscard={() => {}}
        onStay={() => {}}
        onSaveAndContinue={() => {}}
      />,
    );
    expect(screen.queryByText(/Câmpuri modificate/)).not.toBeInTheDocument();
  });

  it('cheamă cele trei acțiuni la clic pe butoanele corespunzătoare', async () => {
    const onDiscard = vi.fn();
    const onStay = vi.fn();
    const onSaveAndContinue = vi.fn();
    render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        onDiscard={onDiscard}
        onStay={onStay}
        onSaveAndContinue={onSaveAndContinue}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Renunță' }));
    expect(onDiscard).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Rămân' }));
    expect(onStay).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Salvez și continui' }));
    expect(onSaveAndContinue).toHaveBeenCalledOnce();
  });

  it('cât `saving` e adevărat, butoanele sunt dezactivate și arată starea de încărcare', () => {
    render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        saving
        onDiscard={() => {}}
        onStay={() => {}}
        onSaveAndContinue={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Renunță' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rămân' })).toBeDisabled();
    expect(screen.getByText('Salvez și continui').closest('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <UnsavedChangesDialog
        open
        formName="copilul nou"
        changedFields={['nume']}
        onDiscard={() => {}}
        onStay={() => {}}
        onSaveAndContinue={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
