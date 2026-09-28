import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BnmRateLink } from './BnmRateLink';

describe('BnmRateLink', () => {
  it('deschide într-o fereastră nouă pagina BNM a zilei cursului', () => {
    render(<BnmRateLink date="2026-09-05" />);
    const link = screen.getByRole('link', { name: 'Verifică pe bnm.md cursul din 05.09.2026' });
    expect(link).toHaveAttribute('href', 'https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=05.09.2026');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
