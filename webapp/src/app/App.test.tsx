import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { ToastProvider } from '@shared/ui';

describe('App', () => {
  it('randează totalul calculat de domain/money.mjs, importat direct din backend', () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    expect(screen.getByText(/total\(\[10, 5\.5\]\) = 15\.5/)).toBeInTheDocument();
  });
});
