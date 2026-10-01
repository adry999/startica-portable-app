import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('arată intervalul curent și totalul de rânduri', () => {
    render(<Pagination page={2} totalPages={13} totalRows={312} pageSize={25} onPageChange={() => {}} />);
    expect(screen.getByText('26–50 din 312')).toBeInTheDocument();
  });

  it('arată selectorul „Pe pagină” doar când e dat onPageSizeChange', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={13} totalRows={312} pageSize={25} onPageChange={() => {}} />,
    );
    expect(screen.queryByText('Pe pagină')).not.toBeInTheDocument();

    rerender(
      <Pagination
        page={1}
        totalPages={13}
        totalRows={312}
        pageSize={25}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    expect(screen.getByText('Pe pagină')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rânduri pe pagină' })).toHaveValue('25');
  });

  it('apelează onPageSizeChange cu numărul ales', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={13}
        totalRows={312}
        pageSize={25}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rânduri pe pagină' }), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('nu randează nimic la o singură pagină', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} totalRows={5} pageSize={25} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('dezactivează „anterioară” pe prima pagină și „următoare” pe ultima', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={5} totalRows={41} pageSize={10} onPageChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Pagina anterioară' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pagina următoare' })).not.toBeDisabled();

    rerender(<Pagination page={5} totalPages={5} totalRows={41} pageSize={10} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pagina anterioară' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pagina următoare' })).toBeDisabled();
  });

  it('apelează onPageChange cu pagina anterioară/următoare/un număr', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} totalRows={41} pageSize={10} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Pagina următoare' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Pagina anterioară' }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: '4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('marchează pagina curentă cu aria-current', () => {
    render(<Pagination page={2} totalPages={5} totalRows={41} pageSize={10} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current');
  });

  it('afișează elipsă și fereastra corectă la multe pagini', () => {
    render(<Pagination page={7} totalPages={13} totalRows={125} pageSize={10} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '13' })).toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBe(2);
    expect(screen.queryByRole('button', { name: '9' })).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Pagination
        page={2}
        totalPages={5}
        totalRows={41}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
