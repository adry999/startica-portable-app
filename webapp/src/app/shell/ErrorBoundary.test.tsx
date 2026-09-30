import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('randează copiii normal cât timp nu apare nicio eroare', () => {
    render(
      <ErrorBoundary>
        <p>ok</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('prinde o eroare de randare și arată ErrorState în loc de ecran alb', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Aplicația a întâmpinat o eroare')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('„Reîncarcă aplicația” reîncarcă pagina', async () => {
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Reîncarcă aplicația' }));

    expect(window.location.reload).toHaveBeenCalled();
  });
});
