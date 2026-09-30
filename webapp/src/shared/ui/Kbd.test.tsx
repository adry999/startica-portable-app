import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Kbd } from './Kbd';

describe('Kbd', () => {
  it('randează un element <kbd> cu textul dat', () => {
    render(<Kbd>Ctrl+K</Kbd>);
    const kbd = screen.getByText('Ctrl+K');
    expect(kbd.tagName).toBe('KBD');
  });

  it('acceptă className suplimentar', () => {
    render(<Kbd className="extra">Esc</Kbd>);
    expect(screen.getByText('Esc').className).toMatch(/extra/);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Kbd>Ctrl+Z</Kbd>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
