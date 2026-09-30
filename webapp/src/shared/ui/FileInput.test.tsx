import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileInput } from './FileInput';

function makeFile(name = 'logo.png', type = 'image/png') {
  return new File(['continut'], name, { type });
}

describe('FileInput', () => {
  it('arată placeholder cât timp nu există valoare', () => {
    render(<FileInput ariaLabel="Logo" onSelect={() => {}} placeholder={<span>G</span>} />);
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('arată previzualizarea când există `value`', () => {
    render(
      <FileInput ariaLabel="Logo" value="data:image/png;base64,abc" onSelect={() => {}} placeholder={<span>G</span>} />,
    );
    expect(screen.getByRole('button', { name: 'Logo' }).querySelector('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,abc',
    );
  });

  it('alegerea unui fișier din selector apelează onSelect', async () => {
    const onSelect = vi.fn();
    const { container } = render(<FileInput ariaLabel="Logo" onSelect={onSelect} accept="image/*" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();

    await userEvent.upload(input, file);

    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('„Schimbă” deschide selectorul de fișiere', async () => {
    const { container } = render(<FileInput ariaLabel="Logo" onSelect={() => {}} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Schimbă' }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('„Șterge” apare doar cu `value` + `onClear` și îl apelează', async () => {
    const onClear = vi.fn();
    const { rerender } = render(<FileInput ariaLabel="Logo" onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Șterge' })).not.toBeInTheDocument();

    rerender(<FileInput ariaLabel="Logo" value="data:image/png;base64,abc" onSelect={() => {}} onClear={onClear} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Șterge' }));

    expect(onClear).toHaveBeenCalled();
  });

  it('dezactivat nu deschide selectorul', async () => {
    const { container } = render(<FileInput ariaLabel="Logo" onSelect={() => {}} disabled />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    await userEvent.click(screen.getByRole('button', { name: 'Logo' }));

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
