import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingBar } from './LoadingBar';

describe('LoadingBar', () => {
  it('randează eticheta pasului și procentul rotunjit', () => {
    render(<LoadingBar percent={42.6} stepLabel="Citesc baza de date…" />);
    expect(screen.getByText('Citesc baza de date…')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
  });
});
