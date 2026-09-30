import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { AppBanner } from './AppBanner';

describe('AppBanner', () => {
  it('randează mesajul primit', () => {
    render(<AppBanner tone="info" message="Versiune nouă disponibilă." />);
    expect(screen.getByText('Versiune nouă disponibilă.')).toBeInTheDocument();
  });

  it('tonul error primește role="alert", celelalte tonuri role="status"', () => {
    const { rerender } = render(<AppBanner tone="error" message="Eroare." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Eroare.');

    rerender(<AppBanner tone="offline" message="Fără conexiune." />);
    expect(screen.getByRole('status')).toHaveTextContent('Fără conexiune.');
  });

  it('nu arată butonul de închidere fără onDismiss', () => {
    render(<AppBanner tone="error" message="Eroare." />);
    expect(screen.queryByRole('button', { name: 'Închide' })).not.toBeInTheDocument();
  });

  it('cheamă onDismiss la clic pe butonul de închidere', async () => {
    const onDismiss = vi.fn();
    render(<AppBanner tone="info" message="Info." onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Închide' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('acțiunea cheamă onClick și arată starea de încărcare', async () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <AppBanner tone="error" message="Eroare." action={{ label: 'Reîncearcă', onClick }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<AppBanner tone="error" message="Eroare." action={{ label: 'Reîncearcă', onClick }} actionLoading />);
    expect(container.querySelector('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <AppBanner tone="warning" message="Verifică datele." action={{ label: 'Vezi', onClick: () => {} }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
