import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveStatusCard } from './SaveStatusCard';

describe('SaveStatusCard', () => {
  it('saved: fără buton de reluare', () => {
    render(<SaveStatusCard status="saved" label="Salvat · 12:06" detail="" onRetry={() => {}} />);
    expect(screen.getByText('Salvat · 12:06')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('unsaved: buton „Salvează acum" apelează onRetry', async () => {
    const onRetry = vi.fn();
    render(<SaveStatusCard status="unsaved" label="Nesalvat" detail="Cădere de rețea" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvează acum' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('error: buton „Încearcă din nou" apelează onRetry', async () => {
    const onRetry = vi.fn();
    render(<SaveStatusCard status="error" label="Salvare neconfirmată" detail="Revizie schimbată" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Încearcă din nou' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('arată avertizarea doar în starea saved', () => {
    const warning = { message: 'Copie externă neconfigurată', actionLabel: 'Configurează', onAction: () => {} };
    render(<SaveStatusCard status="saved" label="Salvat · 12:06" detail="" onRetry={() => {}} warning={warning} />);
    expect(screen.getByText(/Copie externă neconfigurată/)).toBeInTheDocument();

    render(<SaveStatusCard status="saving" label="Se salvează…" detail="x" onRetry={() => {}} warning={warning} />);
    expect(screen.queryAllByText(/Copie externă neconfigurată/)).toHaveLength(1); // tot cel din primul render
  });
});
