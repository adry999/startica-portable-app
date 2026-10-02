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
      <Drawer open title="Copil nou" onClose={() => {}} errorCount={2} footer={<button type="button">Salvează</button>}>
        Conținut
      </Drawer>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 erori');
  });

  it('fără errorCount explicit, numără singur câmpurile native nevalide la o încercare de submit', async () => {
    render(
      <Drawer
        open
        title="Copil nou"
        onClose={() => {}}
        footer={
          <button type="submit" form="f">
            Salvează
          </button>
        }
      >
        <form id="f">
          <input aria-label="Prenume" required />
          <input aria-label="Nume" required />
        </form>
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 erori');
  });
});
