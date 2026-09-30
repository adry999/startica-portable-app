import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyField } from './CopyField';

describe('CopyField', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('randează valoarea într-un input readonly', () => {
    render(<CopyField value="7F3K-9QRT" ariaLabel="Cod de asociere" />);
    const input = screen.getByLabelText('Cod de asociere') as HTMLInputElement;
    expect(input).toHaveValue('7F3K-9QRT');
    expect(input).toHaveAttribute('readonly');
  });

  it('randează hint-ul dat', () => {
    render(<CopyField value="7F3K-9QRT" hint="Expiră în 4:32" />);
    expect(screen.getByText('Expiră în 4:32')).toBeInTheDocument();
  });

  it('copiază valoarea și arată confirmarea, apoi revine', async () => {
    render(<CopyField value="7F3K-9QRT" ariaLabel="Cod de asociere" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiază' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('7F3K-9QRT');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiat!' })).toBeInTheDocument());

    vi.advanceTimersByTime(1500);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiază' })).toBeInTheDocument());
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<CopyField value="7F3K-9QRT" ariaLabel="Cod de asociere" hint="Expiră în 4:32" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
