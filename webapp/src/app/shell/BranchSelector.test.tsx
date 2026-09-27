import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BranchSelector } from './BranchSelector';

const buiucani = { id: 'b1', name: 'Buiucani', color: 'orange', address: 'str. Exemplu 12' };
const botanica = { id: 'b2', name: 'Botanica', color: 'mint', address: 'bd. Exemplu 5' };

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('BranchSelector', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          activeBranchId: buiucani.id,
          branches: [
            { ...buiucani, children: 99, groups: 3 },
            { ...botanica, children: 42, groups: 3 },
          ],
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('butonul arată inițialele, numele și culoarea filialei curente', () => {
    render(
      <BranchSelector branch={buiucani} branches={[buiucani, botanica]} onSwitch={() => {}} onManage={() => {}} />,
    );
    const trigger = screen.getByRole('button', { name: /Buiucani/ });
    expect(trigger).toHaveTextContent('Bu');
    expect(trigger).toHaveTextContent('Buiucani');
    expect(trigger.className).toMatch(/orange/);
  });

  it('dropdown-ul listează filialele cu ✓ pe cea curentă și se închide la Esc', async () => {
    const user = userEvent.setup();
    render(
      <BranchSelector branch={buiucani} branches={[buiucani, botanica]} onSwitch={() => {}} onManage={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: /Buiucani/ }));
    expect(screen.getByText('Schimbă filiala')).toBeInTheDocument();
    const buiucaniRow = screen.getByRole('button', { name: /Buiucani.*copii/ });
    expect(buiucaniRow).toHaveTextContent('✓');
    const botanicaRow = screen.getByRole('button', { name: /Botanica.*copii/ });
    expect(botanicaRow).not.toHaveTextContent('✓');
    await waitFor(() => expect(buiucaniRow).toHaveTextContent('99 copii'));

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Schimbă filiala')).not.toBeInTheDocument();
  });

  it('click pe o altă filială din dropdown declanșează onSwitch', async () => {
    const onSwitch = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchSelector branch={buiucani} branches={[buiucani, botanica]} onSwitch={onSwitch} onManage={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: /Buiucani/ }));
    await user.click(screen.getByRole('button', { name: /Botanica.*copii/ }));
    expect(onSwitch).toHaveBeenCalledWith('b2');
  });

  it('„Administrează filialele →” apelează onManage', async () => {
    const onManage = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchSelector branch={buiucani} branches={[buiucani, botanica]} onSwitch={() => {}} onManage={onManage} />,
    );

    await user.click(screen.getByRole('button', { name: /Buiucani/ }));
    await user.click(screen.getByRole('button', { name: /Administrează filialele/ }));
    expect(onManage).toHaveBeenCalled();
  });
});
