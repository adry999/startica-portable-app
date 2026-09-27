import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BranchSwitchDialog } from './BranchSwitchDialog';

describe('BranchSwitchDialog', () => {
  const form = { label: 'o achitare', save: vi.fn(async () => true) };

  it('arată numele formularului și filialele, cu cele trei acțiuni', () => {
    render(
      <BranchSwitchDialog
        form={form}
        fromName="Buiucani"
        toName="Botanica"
        onStay={() => {}}
        onDiscard={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByText('Ai o achitare nesalvată în Buiucani')).toBeInTheDocument();
    expect(screen.getByText(/Botanica/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rămân aici' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renunț și schimb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează și schimbă' })).toBeInTheDocument();
  });

  it('fiecare buton apelează acțiunea corespunzătoare', async () => {
    const onStay = vi.fn();
    const onDiscard = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchSwitchDialog
        form={form}
        fromName="Buiucani"
        toName="Botanica"
        onStay={onStay}
        onDiscard={onDiscard}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Renunț și schimb' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Salvează și schimbă' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Rămân aici' }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('Esc rămâne pe loc (onStay)', async () => {
    const onStay = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchSwitchDialog
        form={form}
        fromName="Buiucani"
        toName="Botanica"
        onStay={onStay}
        onDiscard={() => {}}
        onSave={() => {}}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onStay).toHaveBeenCalledTimes(1);
  });
});
