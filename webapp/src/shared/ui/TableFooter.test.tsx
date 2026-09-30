import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Pagination } from './Pagination';
import { TableFooter } from './TableFooter';

describe('TableFooter', () => {
  it('arată textul de rezumat', () => {
    render(<TableFooter summary="24 de rezultate" />);
    expect(screen.getByText('24 de rezultate')).toBeInTheDocument();
  });

  it('randează sloțul de paginare doar când e dat', () => {
    const { rerender } = render(<TableFooter summary="24 de rezultate" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    rerender(
      <TableFooter
        summary="24 de rezultate"
        pagination={<Pagination page={1} totalPages={3} onPageChange={() => {}} />}
      />,
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <TableFooter
        summary="24 de rezultate"
        pagination={<Pagination page={1} totalPages={3} onPageChange={() => {}} />}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
