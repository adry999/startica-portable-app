import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('nu randează nimic când open e false', () => {
    render(
      <Dialog open={false} title="Confirmă" onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('randează titlul și conținutul când open e true', () => {
    render(
      <Dialog open title="Confirmă" onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirmă' })).toBeInTheDocument();
    expect(screen.getByText('Conținut')).toBeInTheDocument();
  });

  it('ariaLabel separă numele accesibil de titlul vizibil', () => {
    render(
      <Dialog open title="Plătește 3 salarii" ariaLabel="Confirmă plata" onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirmă plata' })).toBeInTheDocument();
    expect(screen.getByText('Plătește 3 salarii')).toBeInTheDocument();
  });

  it('se închide la click pe overlay, nu la click în interior', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Confirmă" onClose={onClose}>
        Conținut
      </Dialog>,
    );
    await userEvent.click(screen.getByText('Conținut'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('se închide la Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Confirmă" onClose={onClose}>
        Conținut
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blochează închiderea când shouldBlockClose întoarce true', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Confirmă" onClose={onClose} shouldBlockClose={() => true}>
        Conținut
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Închide' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hideClose ascunde butonul ×, fără altă schimbare de comportament (46d)', () => {
    render(
      <Dialog open title="Restaurare gata" onClose={() => {}} hideClose>
        Conținut
      </Dialog>,
    );
    expect(screen.queryByRole('button', { name: 'Închide' })).not.toBeInTheDocument();
  });

  it('randează footer-ul când e dat', () => {
    render(
      <Dialog open title="Confirmă" onClose={() => {}} footer={<button type="button">Salvează</button>}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Dialog open title="Confirmă" onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lățimea implicită e tokenul --dialog (44d), un width numeric rămâne o portiță de ieșire', () => {
    const { rerender } = render(
      <Dialog open title="Confirmă" onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveStyle({ width: 'var(--dialog)' });

    rerender(
      <Dialog open title="Restaurare gata" width={560} onClose={() => {}}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '560px' });
  });

  it('focus pe primul câmp la deschidere, fără să fure focus-ul butonul × (44d)', async () => {
    render(
      <Dialog open title="Confirmă" onClose={() => {}}>
        <input aria-label="Motiv" />
      </Dialog>,
    );
    await waitFor(() => expect(screen.getByLabelText('Motiv')).toHaveFocus());
  });

  it('Ctrl+Enter trimite formularul din panou (44d)', async () => {
    const onSubmit = vi.fn(event => event.preventDefault());
    render(
      <Dialog open title="Confirmă" onClose={() => {}}>
        <form onSubmit={onSubmit}>
          <input aria-label="Motiv" />
        </form>
      </Dialog>,
    );
    await userEvent.click(screen.getByLabelText('Motiv'));
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('„N erori” în subsol prin errorCount explicit (44d)', () => {
    render(
      <Dialog open title="Confirmă" onClose={() => {}} errorCount={1}>
        Conținut
      </Dialog>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('1 eroare');
  });

  it('Esc închide doar panoul de sus (40c peste un Drawer/Dialog rămas deschis dedesubt)', async () => {
    const onCloseBack = vi.fn();
    const onCloseTop = vi.fn();
    render(
      <>
        <Dialog open title="Confirmă" onClose={onCloseBack}>
          Conținut
        </Dialog>
        <Dialog open title="Renunți la modificări?" onClose={onCloseTop}>
          Conținut
        </Dialog>
      </>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onCloseTop).toHaveBeenCalledOnce();
    expect(onCloseBack).not.toHaveBeenCalled();
  });
});
