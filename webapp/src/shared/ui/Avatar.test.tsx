import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('arată inițialele din primul și ultimul cuvânt al numelui', () => {
    render(<Avatar name="Coceva Alisa" />);
    expect(screen.getByText('CA')).toBeInTheDocument();
  });

  it('arată o singură inițială pentru un nume dintr-un cuvânt', () => {
    render(<Avatar name="Madalina" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('același nume primește mereu același ton', () => {
    const { container: first } = render(<Avatar name="Ion Rusu" />);
    const { container: second } = render(<Avatar name="Ion Rusu" />);
    expect(first.firstElementChild?.className).toBe(second.firstElementChild?.className);
  });

  it('randează o imagine decorativă când `src` e furnizat', () => {
    render(<Avatar name="Ion Rusu" src="/poza.jpg" />);
    const image = screen.getByRole('presentation', { hidden: true }) as HTMLImageElement;
    expect(image.src).toContain('/poza.jpg');
    expect(image.alt).toBe('');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Avatar name="Coceva Alisa" size={64} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
