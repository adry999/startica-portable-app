import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersonCell } from './PersonCell';

describe('PersonCell', () => {
  it('randează inițialele din primele două cuvinte', () => {
    render(<PersonCell name="Coceva Alisa" />);
    expect(screen.getByText('CA')).toBeInTheDocument();
    expect(screen.getByText('Coceva Alisa')).toBeInTheDocument();
  });

  it('randează sub doar când e primit', () => {
    const { rerender } = render(<PersonCell name="Ana Pop" sub="Contract 214" />);
    expect(screen.getByText('Contract 214')).toBeInTheDocument();

    rerender(<PersonCell name="Ana Pop" />);
    expect(screen.queryByText('Contract 214')).not.toBeInTheDocument();
  });

  it('aplică tonul cerut pe avatar', () => {
    render(<PersonCell name="Ana Pop" tone="orange" />);
    expect(screen.getByText('AP').className).toMatch(/orange/);
  });

  it('folosește tonul neutral implicit', () => {
    render(<PersonCell name="Ana Pop" />);
    expect(screen.getByText('AP').className).toMatch(/neutral/);
  });
});
