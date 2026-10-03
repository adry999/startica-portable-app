import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('nu randează nimic când open e false', () => {
    render(
      <Drawer open={false} title="Copil nou" onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('randează titlul și conținutul când open e true', () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Copil nou' })).toBeInTheDocument();
    expect(screen.getByText('Conținut')).toBeInTheDocument();
  });

  it('se închide la click pe overlay, nu la click în interior', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Copil nou" onClose={onClose}>
        Conținut
      </Drawer>,
    );
    await userEvent.click(screen.getByText('Conținut'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('se închide la Escape', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Copil nou" onClose={onClose}>
        Conținut
      </Drawer>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blochează închiderea când shouldBlockClose întoarce true', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Copil nou" onClose={onClose} shouldBlockClose={() => true}>
        Conținut
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Închide' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lățimea implicită e tokenul --drawer-form (44d), size="detail" trece pe --drawer-detail', () => {
    const { rerender } = render(
      <Drawer open title="Copil nou" onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveStyle({ width: 'var(--drawer-form)' });

    rerender(
      <Drawer open title="Copil nou" size="detail" onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveStyle({ width: 'var(--drawer-detail)' });
  });

  it('un width numeric explicit rămâne o portiță de ieșire peste size', () => {
    render(
      <Drawer open title="Restaurare" width={560} onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '560px' });
  });

  it('focus pe primul câmp la deschidere (44d)', async () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}}>
        <form>
          <label htmlFor="first">Prenume</label>
          <input id="first" />
          <label htmlFor="last">Nume</label>
          <input id="last" />
        </form>
      </Drawer>,
    );
    await waitFor(() => expect(screen.getByLabelText('Prenume')).toHaveFocus());
  });

  it('butonul × din antet nu fură focus-ul inițial', async () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}}>
        <input aria-label="Prenume" />
      </Drawer>,
    );
    await waitFor(() => expect(screen.getByLabelText('Prenume')).toHaveFocus());
  });

  it('Ctrl+Enter trimite formularul din panou (44d)', async () => {
    const onSubmit = vi.fn(event => event.preventDefault());
    render(
      <Drawer open title="Copil nou" onClose={() => {}}>
        <form onSubmit={onSubmit}>
          <input aria-label="Prenume" />
        </form>
      </Drawer>,
    );
    await userEvent.click(screen.getByLabelText('Prenume'));
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('„N erori” în subsol prin errorCount explicit (44d)', () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}} errorCount={2} primary={{ label: 'Salvează' }}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: '2 erori' })).toBeInTheDocument();
  });

  it('fără errorCount explicit, numără singur câmpurile native nevalide la o încercare de submit', async () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}} primary={{ label: 'Salvează', form: 'f' }}>
        <form id="f">
          <input aria-label="Prenume" required />
          <input aria-label="Nume" required />
        </form>
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(await screen.findByRole('button', { name: '2 erori' })).toBeInTheDocument();
  });

  it('subsolul unificat (F19/§6): Anulează implicit + principal, ordinea fixă', () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}} primary={{ label: 'Salvează copilul', form: 'f' }}>
        Conținut
      </Drawer>,
    );
    const buttons = screen.getAllByRole('button').map(button => button.textContent);
    expect(buttons.indexOf('Anulează')).toBeLessThan(buttons.indexOf('Salvează copilul'));
  });

  it('Anulează implicit cheamă requestClose (shouldBlockClose se aplică)', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Copil nou" onClose={onClose} shouldBlockClose={() => true} primary={{ label: 'Salvează' }}>
        Conținut
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hideCancel ascunde Anulează', () => {
    render(
      <Drawer open title="Restaurare gata" onClose={() => {}} hideCancel primary={{ label: 'Reîncarcă acum' }}>
        Conținut
      </Drawer>,
    );
    expect(screen.queryByRole('button', { name: 'Anulează' })).not.toBeInTheDocument();
  });

  it('primary.disabled cere disabledReason, afișat în stânga subsolului', () => {
    render(
      <Drawer
        open
        title="Grupe"
        onClose={() => {}}
        primary={{ label: 'Salvează', disabled: true, disabledReason: 'Fără modificări' }}
      >
        Conținut
      </Drawer>,
    );
    expect(screen.getByText('Fără modificări')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled();
  });

  it('primary.loading arată „Salvez…” și dezactivează Anulează', () => {
    render(
      <Drawer open title="Copil nou" onClose={() => {}} primary={{ label: 'Salvează copilul', loading: true }}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: /Salvez…/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anulează' })).toBeDisabled();
  });

  it('fără primary/footerStart, nu randează niciun subsol', () => {
    render(
      <Drawer open title="Istoric" onClose={() => {}}>
        Conținut
      </Drawer>,
    );
    expect(screen.queryByRole('button', { name: 'Anulează' })).not.toBeInTheDocument();
  });
});
