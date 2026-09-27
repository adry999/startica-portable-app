import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('randează forma cu carduri, căutare și 8 rânduri', () => {
    const { container } = render(<Skeleton />);
    expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(8);
    expect(container.querySelectorAll('[class*="card"]').length).toBeGreaterThanOrEqual(4);
  });
});
