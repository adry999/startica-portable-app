import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Legend } from './Legend';

describe('Legend', () => {
  it('randează câte o etichetă pentru fiecare item', () => {
    render(
      <Legend
        items={[
          { tone: 'mint', label: 'Cash 12 450 lei' },
          { tone: 'orange', label: 'Card 8 200 lei' },
        ]}
      />,
    );
    expect(screen.getByText('Cash 12 450 lei')).toBeInTheDocument();
    expect(screen.getByText('Card 8 200 lei')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Legend
        items={[
          { tone: 'mint', label: 'Cash 12 450 lei' },
          { tone: 'orange', label: 'Card 8 200 lei' },
          { tone: 'yellow', label: 'Transfer 3 100 lei' },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
