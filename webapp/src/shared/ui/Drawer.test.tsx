import { render, screen } from '@testing-library/react';
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
});
