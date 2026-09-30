import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('randează svg-ul cerut, ascuns de accesibilitate', () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('acceptă o mărime diferită de cea implicită', () => {
    const { container } = render(<Icon name="check" size={24} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
  });

  it('devine accesibilă de sine stătător când primește ariaLabel', () => {
    const { container } = render(<Icon name="close" ariaLabel="Închide" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label', 'Închide');
    expect(svg).not.toHaveAttribute('aria-hidden', 'true');
  });
});
