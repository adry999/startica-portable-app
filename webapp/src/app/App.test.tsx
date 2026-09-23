import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('randează totalul calculat de domain/money.mjs, importat direct din backend', () => {
    render(<App />);
    expect(screen.getByText(/total\(\[10, 5\.5\]\) = 15\.5/)).toBeInTheDocument();
  });
});
