import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('randează titlul implicit când nu se dă unul', () => {
    render(<ErrorState />);
    expect(screen.getByText('Nu am putut încărca datele')).toBeInTheDocument();
  });

  it('randează titlul, descrierea și codul tehnic date', () => {
    render(
      <ErrorState
        title="Nu am putut încărca achitările"
        description="Verifică legătura și încearcă din nou."
        technicalDetail="fetch failed: ECONNREFUSED"
      />,
    );
    expect(screen.getByText('Nu am putut încărca achitările')).toBeInTheDocument();
    expect(screen.getByText('Verifică legătura și încearcă din nou.')).toBeInTheDocument();
    expect(screen.getByText('fetch failed: ECONNREFUSED')).toBeInTheDocument();
  });

  it('declanșează onRetry la clic pe buton, cu eticheta implicită', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Încearcă din nou' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('folosește retryLabel dat, când e prezent', () => {
    render(<ErrorState onRetry={() => {}} retryLabel="Reîncarcă" />);
    expect(screen.getByRole('button', { name: 'Reîncarcă' })).toBeInTheDocument();
  });

  it('nu randează butonul fără onRetry', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <ErrorState
        description="Verifică legătura și încearcă din nou."
        technicalDetail="fetch failed"
        onRetry={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
