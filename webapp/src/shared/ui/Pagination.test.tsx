import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('arată „Pagina X din Y”', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText('Pagina 2 din 5')).toBeInTheDocument();
  });

  it('dezactivează „anterioară” pe prima pagină și „următoare” pe ultima', () => {
    const { rerender } = render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pagina anterioară' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pagina următoare' })).not.toBeDisabled();

    rerender(<Pagination page={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pagina anterioară' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pagina următoare' })).toBeDisabled();
  });

  it('apelează onPageChange cu pagina anterioară/următoare', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Pagina următoare' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Pagina anterioară' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
