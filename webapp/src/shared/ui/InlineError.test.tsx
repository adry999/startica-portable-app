import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { InlineError } from './InlineError';

describe('InlineError', () => {
  it('randează mesajul dat', () => {
    render(<InlineError message="Numărul de telefon nu e valid." />);
    expect(screen.getByText('Numărul de telefon nu e valid.')).toBeInTheDocument();
  });

  it('expune mesajul cu role="alert"', () => {
    render(<InlineError message="Câmp obligatoriu." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Câmp obligatoriu.');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<InlineError message="Numărul de telefon nu e valid." />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
