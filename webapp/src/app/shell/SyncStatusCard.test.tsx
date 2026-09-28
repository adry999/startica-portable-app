import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SyncStatusCard } from './SyncStatusCard';

describe('SyncStatusCard', () => {
  it('starea conflict arată contorul și linkul Rezolvă', async () => {
    const onAction = vi.fn();
    render(
      <SyncStatusCard
        mode="conflict"
        label="2 conflicte"
        detail="Aceleași date modificate pe alt calculator."
        actionLabel="Rezolvă"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('2 conflicte')).toBeInTheDocument();
    const link = screen.getByRole('button', { name: 'Rezolvă' });
    await userEvent.click(link);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('starea sincronizat nu arată niciun buton de acțiune', () => {
    render(<SyncStatusCard mode="synced" label="Sincronizat · 12:06" detail="Toate calculatoarele au aceleași date" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('starea fără internet arată detaliul, fără acțiune', () => {
    render(<SyncStatusCard mode="offline" label="Fără internet" detail="3 modificări salvate local." />);
    expect(screen.getByText('Fără internet')).toBeInTheDocument();
    expect(screen.getByText('3 modificări salvate local.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('click pe card deschide 14b, indiferent de stare', async () => {
    const onCardClick = vi.fn();
    render(
      <SyncStatusCard
        mode="synced"
        label="Sincronizat · 12:06"
        detail="Toate calculatoarele au aceleași date"
        onCardClick={onCardClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Sincronizat/ }));
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it('click pe linkul Rezolvă nu declanșează și click pe card', async () => {
    const onAction = vi.fn();
    const onCardClick = vi.fn();
    render(
      <SyncStatusCard
        mode="conflict"
        label="2 conflicte"
        detail="Aceleași date modificate pe alt calculator."
        actionLabel="Rezolvă"
        onAction={onAction}
        onCardClick={onCardClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rezolvă' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
