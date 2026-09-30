import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { CountBadge } from './CountBadge';

describe('CountBadge', () => {
  it('randează numărul primit', () => {
    render(<CountBadge count={3} tone="action" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('nu randează nimic când count e 0', () => {
    const { container } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('arată "max+" peste pragul `max`', () => {
    render(<CountBadge count={140} max={99} tone="action" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('folosește tonul informativ implicit', () => {
    render(<CountBadge count={12} />);
    expect(screen.getByText('12').className).toMatch(/informative/);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<CountBadge count={5} tone="action" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
