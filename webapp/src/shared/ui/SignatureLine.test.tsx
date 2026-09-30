import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignatureLine } from './SignatureLine';

describe('SignatureLine', () => {
  it('randează eticheta sub bară', () => {
    render(<SignatureLine>Primit: administrator</SignatureLine>);
    expect(screen.getByText('Primit: administrator')).toBeInTheDocument();
  });
});
