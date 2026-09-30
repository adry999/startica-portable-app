import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThermalBlock } from './ThermalBlock';

describe('ThermalBlock', () => {
  it('randează acțiunile și conținutul bonului', () => {
    render(
      <ThermalBlock actions={<button type="button">Tipărește</button>}>
        <span>Conținut bon</span>
      </ThermalBlock>,
    );
    expect(screen.getByRole('button', { name: 'Tipărește' })).toBeInTheDocument();
    expect(screen.getByText('Conținut bon')).toBeInTheDocument();
  });
});
