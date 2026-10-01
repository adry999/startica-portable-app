import { render, screen } from '@testing-library/react';
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
});
