import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Kpi } from './Kpi';

describe('Kpi', () => {
  it('randează eticheta și valoarea în starea ready', () => {
    render(<Kpi label="Încasări" value="45 320 lei" />);
    expect(screen.getByText('Încasări')).toBeInTheDocument();
    expect(screen.getByText('45 320 lei')).toBeInTheDocument();
  });

  // 44c: un mini-card de metodă e clic-abil, ca să filtreze lista de achitări.
  it('cu onClick, devine un buton care declanșează filtrul la clic', async () => {
    const onClick = vi.fn();
    render(<Kpi label="Cash" value="1 000 lei" onClick={onClick} />);
    const user = userEvent.setup();

    const card = screen.getByRole('button', { name: /Cash/ });
    await user.click(card);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('fără onClick, rămâne un simplu container, nu un buton', () => {
    render(<Kpi label="Cash" value="1 000 lei" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('randează children sub valoare', () => {
    render(
      <Kpi label="Încasări" value="45 320 lei">
        <span>Cash 100 lei</span>
      </Kpi>,
    );
    expect(screen.getByText('Cash 100 lei')).toBeInTheDocument();
  });

  it('randează schelet în starea loading, fără eticheta sau valoarea reală', () => {
    render(<Kpi label="Încasări" value="45 320 lei" state="loading" />);
    expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    expect(screen.queryByText('Încasări')).not.toBeInTheDocument();
    expect(screen.queryByText('45 320 lei')).not.toBeInTheDocument();
  });

  it('randează valoarea reală estompată în starea refreshing', () => {
    render(<Kpi label="Diferență" value="12 100 lei" state="refreshing" />);
    expect(screen.getByText('12 100 lei').closest('div')?.className).toMatch(/refreshing/);
  });

  it('randează „—” și butonul Reîncearcă în starea error', async () => {
    const onRetry = vi.fn();
    render(<Kpi label="Avansuri" value="45 320 lei" state="error" onRetry={onRetry} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('45 320 lei')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('nu randează butonul Reîncearcă fără onRetry', () => {
    render(<Kpi label="Avansuri" value="45 320 lei" state="error" />);
    expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Kpi label="Încasări" value="45 320 lei" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('activeTone adaugă un contur în „ink”, independent de fundalul tone', () => {
    const { container } = render(<Kpi tone="white" activeTone="orange" label="Cash" value="12 000 lei" />);
    expect(container.firstElementChild?.className).toMatch(/activeOrange/);
  });

  it('fără activeTone, cardul nu are conturul „active”', () => {
    const { container } = render(<Kpi label="Cash" value="12 000 lei" />);
    expect(container.firstElementChild?.className).not.toMatch(/active[A-Z]/);
  });
});
