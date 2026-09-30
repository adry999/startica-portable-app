import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintFooter } from './PrintFooter';

describe('PrintFooter', () => {
  it('randează nota și data de tipărire', () => {
    render(<PrintFooter printedAt="2026-09-30T10:00:00.000Z">Sume în lei.</PrintFooter>);
    expect(screen.getByText('Sume în lei.')).toBeInTheDocument();
    expect(screen.getByText(/tipărit la/)).toBeInTheDocument();
  });
});
