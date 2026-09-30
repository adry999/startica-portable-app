import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PrintOptionsDialog } from './PrintOptionsDialog';

describe('PrintOptionsDialog', () => {
  it('titlul implicit e „Opțiuni de printare"', () => {
    render(
      <PrintOptionsDialog open onClose={() => {}} onPrint={() => {}}>
        <p>Opțiuni</p>
      </PrintOptionsDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Opțiuni de printare' })).toBeInTheDocument();
  });

  it('titlul e personalizabil', () => {
    render(
      <PrintOptionsDialog open title="Printează chitanța" onClose={() => {}} onPrint={() => {}}>
        <p>Opțiuni</p>
      </PrintOptionsDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Printează chitanța' })).toBeInTheDocument();
  });

  it('randează conținutul dat de apelant', () => {
    render(
      <PrintOptionsDialog open onClose={() => {}} onPrint={() => {}}>
        <p>Formular de opțiuni</p>
      </PrintOptionsDialog>,
    );
    expect(screen.getByText('Formular de opțiuni')).toBeInTheDocument();
  });

  it('cheamă onClose/onPrint la clic pe butoane', async () => {
    const onClose = vi.fn();
    const onPrint = vi.fn();
    render(
      <PrintOptionsDialog open onClose={onClose} onPrint={onPrint}>
        <p>Opțiuni</p>
      </PrintOptionsDialog>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(onClose).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Printează' }));
    expect(onPrint).toHaveBeenCalledOnce();
  });

  it('cât `printing` e adevărat, butonul arată starea de încărcare și Anulează e dezactivat', () => {
    render(
      <PrintOptionsDialog open printing onClose={() => {}} onPrint={() => {}}>
        <p>Opțiuni</p>
      </PrintOptionsDialog>,
    );
    expect(screen.getByRole('button', { name: /Se printează…/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <PrintOptionsDialog open onClose={() => {}} onPrint={() => {}}>
        <p>Opțiuni de printare demonstrative.</p>
      </PrintOptionsDialog>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
