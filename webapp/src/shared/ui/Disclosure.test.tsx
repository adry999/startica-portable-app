import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Disclosure } from './Disclosure';

describe('Disclosure', () => {
  it('e închis implicit — conținutul nu e vizibil', () => {
    render(
      <Disclosure title="Detalii suplimentare">
        <p>Conținut ascuns</p>
      </Disclosure>,
    );
    expect(screen.getByText('Conținut ascuns')).not.toBeVisible();
  });

  it('defaultOpen randează deschis', () => {
    render(
      <Disclosure title="Detalii suplimentare" defaultOpen>
        <p>Conținut vizibil</p>
      </Disclosure>,
    );
    expect(screen.getByText('Conținut vizibil')).toBeVisible();
  });

  it('clic pe antet deschide/închide secțiunea (necontrolat)', async () => {
    render(
      <Disclosure title="Detalii suplimentare">
        <p>Conținut</p>
      </Disclosure>,
    );
    expect(screen.getByText('Conținut')).not.toBeVisible();

    await userEvent.click(screen.getByText('Detalii suplimentare'));
    expect(screen.getByText('Conținut')).toBeVisible();

    await userEvent.click(screen.getByText('Detalii suplimentare'));
    expect(screen.getByText('Conținut')).not.toBeVisible();
  });

  it('controlat: `open` decide starea și clicul cheamă onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Disclosure title="Detalii" open={false} onOpenChange={onOpenChange}>
        <p>Conținut</p>
      </Disclosure>,
    );
    expect(screen.getByText('Conținut')).not.toBeVisible();

    await userEvent.click(screen.getByText('Detalii'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Necontrolat de click — starea reală tot vine din prop-ul `open`, care n-a fost schimbat încă.
    rerender(
      <Disclosure title="Detalii" open={true} onOpenChange={onOpenChange}>
        <p>Conținut</p>
      </Disclosure>,
    );
    expect(screen.getByText('Conținut')).toBeVisible();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Disclosure title="Detalii suplimentare" defaultOpen>
        <p>Conținutul secțiunii pliabile.</p>
      </Disclosure>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
