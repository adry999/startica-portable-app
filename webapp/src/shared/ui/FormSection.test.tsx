import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { FormSection } from './FormSection';

describe('FormSection', () => {
  it('randează titlul ca heading și copiii', () => {
    render(
      <FormSection title="Date de contact">
        <p>Câmp</p>
      </FormSection>,
    );
    expect(screen.getByRole('heading', { name: 'Date de contact' })).toBeInTheDocument();
    expect(screen.getByText('Câmp')).toBeInTheDocument();
  });

  it('randează descrierea doar când e dată', () => {
    const { rerender } = render(
      <FormSection title="Date de contact" description="Folosite pentru SMS.">
        <p>Câmp</p>
      </FormSection>,
    );
    expect(screen.getByText('Folosite pentru SMS.')).toBeInTheDocument();

    rerender(
      <FormSection title="Date de contact">
        <p>Câmp</p>
      </FormSection>,
    );
    expect(screen.queryByText('Folosite pentru SMS.')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <FormSection title="Date de contact" description="Folosite pentru SMS.">
        <p>Câmp</p>
      </FormSection>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
