import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('randează conținutul primit', () => {
    render(<Badge tone="mint">Achitat</Badge>);
    expect(screen.getByText('Achitat')).toBeInTheDocument();
  });

  it('foloseste tonul neutral când nu e specificat', () => {
    render(<Badge>Scadent</Badge>);
    expect(screen.getByText('Scadent').className).toMatch(/neutral/);
  });
});
