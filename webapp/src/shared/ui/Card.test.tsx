import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('randează ca div când nu are onClick', () => {
    render(<Card>Conținut</Card>);
    expect(screen.getByText('Conținut').tagName).toBe('DIV');
  });

  it('randează ca buton accesibil și declanșează onClick', async () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Grupa Fluturași</Card>);
    await userEvent.click(screen.getByRole('button', { name: 'Grupa Fluturași' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
