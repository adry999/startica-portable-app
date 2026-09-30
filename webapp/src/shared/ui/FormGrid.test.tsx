import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { FormGrid } from './FormGrid';

describe('FormGrid', () => {
  it('randează copiii', () => {
    render(
      <FormGrid>
        <div>Câmp 1</div>
        <div>Câmp 2</div>
      </FormGrid>,
    );
    expect(screen.getByText('Câmp 1')).toBeInTheDocument();
    expect(screen.getByText('Câmp 2')).toBeInTheDocument();
  });

  it('implicit are 2 coloane', () => {
    const { container } = render(
      <FormGrid>
        <div>Câmp</div>
      </FormGrid>,
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/twoColumns/);
  });

  it('columns=1 folosește o singură coloană', () => {
    const { container } = render(
      <FormGrid columns={1}>
        <div>Câmp</div>
      </FormGrid>,
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/oneColumn/);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <FormGrid>
        <div>Câmp 1</div>
        <div>Câmp 2</div>
      </FormGrid>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
