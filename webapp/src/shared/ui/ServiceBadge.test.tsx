import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceBadge, serviceTone } from './ServiceBadge';

describe('ServiceBadge', () => {
  it('randează numele serviciului', () => {
    render(<ServiceBadge service={{ name: 'Bazin', tone: 'mint' }} />);
    expect(screen.getByText('Bazin')).toBeInTheDocument();
  });

  it('serviceTone() întoarce direct tonul serviciului', () => {
    expect(serviceTone({ name: 'Educație', tone: 'yellow' })).toBe('yellow');
  });

  it('tonul serviciului ajunge pe clasa Badge-ului', () => {
    render(<ServiceBadge service={{ name: 'Masă', tone: 'coral' }} />);
    expect(screen.getByText('Masă').className).toMatch(/coral/);
  });
});
