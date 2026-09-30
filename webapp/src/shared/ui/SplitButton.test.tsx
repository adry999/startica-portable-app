import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SplitButton } from './SplitButton';

const OPTIONS = [
  { value: 'pdf', label: 'Exportă PDF', onClick: vi.fn() },
  { value: 'excel', label: 'Exportă Excel', onClick: vi.fn() },
];

describe('SplitButton', () => {
  it('arată eticheta opțiunii curent selectate pe butonul principal', () => {
    render(<SplitButton options={OPTIONS} selectedValue="excel" onSelectedValueChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Exportă Excel' })).toBeInTheDocument();
  });

  it('clic pe butonul principal rulează opțiunea selectată', async () => {
    const user = userEvent.setup();
    const onClickPdf = vi.fn();
    const options = [
      { value: 'pdf', label: 'Exportă PDF', onClick: onClickPdf },
      { value: 'excel', label: 'Exportă Excel', onClick: vi.fn() },
    ];
    render(<SplitButton options={options} selectedValue="pdf" onSelectedValueChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Exportă PDF' }));
    expect(onClickPdf).toHaveBeenCalledTimes(1);
  });

  it('▾ deschide lista de variante', async () => {
    const user = userEvent.setup();
    render(<SplitButton options={OPTIONS} selectedValue="pdf" onSelectedValueChange={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Exportă Excel' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alte variante' }));

    expect(screen.getByRole('button', { name: 'Exportă Excel' })).toBeInTheDocument();
  });

  it('alegerea unei variante din listă schimbă selecția ținută minte și rulează acțiunea ei', async () => {
    const user = userEvent.setup();
    const onSelectedValueChange = vi.fn();
    const onClickExcel = vi.fn();
    const options = [
      { value: 'pdf', label: 'Exportă PDF', onClick: vi.fn() },
      { value: 'excel', label: 'Exportă Excel', onClick: onClickExcel },
    ];
    render(<SplitButton options={options} selectedValue="pdf" onSelectedValueChange={onSelectedValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Alte variante' }));
    await user.click(screen.getByRole('button', { name: 'Exportă Excel' }));

    expect(onSelectedValueChange).toHaveBeenCalledWith('excel');
    expect(onClickExcel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Exportă Excel' })).not.toBeInTheDocument();
  });

  it('loading dezactivează tot butonul și arată spinner în locul săgeții', () => {
    const { container } = render(
      <SplitButton options={OPTIONS} selectedValue="pdf" onSelectedValueChange={() => {}} loading />,
    );
    const buttons = container.querySelectorAll('button');

    expect(buttons).toHaveLength(2);
    buttons.forEach(button => expect(button).toBeDisabled());
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(2);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <SplitButton options={OPTIONS} selectedValue="pdf" onSelectedValueChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
