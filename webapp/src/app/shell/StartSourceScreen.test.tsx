import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { StartSourceScreen } from './StartSourceScreen';

describe('StartSourceScreen', () => {
  it('„Din backup” e selectat implicit (recomandat)', () => {
    render(<StartSourceScreen onContinue={() => {}} />);
    expect(screen.getByRole('radio', { name: /Din backup/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('clic pe un card îl selectează fără să continue', async () => {
    const onContinue = vi.fn();
    render(<StartSourceScreen onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('radio', { name: /De la zero/ }));
    expect(screen.getByRole('radio', { name: /De la zero/ })).toHaveAttribute('aria-checked', 'true');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('butonul Continuă trimite opțiunea selectată', async () => {
    const onContinue = vi.fn();
    render(<StartSourceScreen onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('radio', { name: /Am Startica pe alt calculator/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continuă/ }));
    expect(onContinue).toHaveBeenCalledWith('connect');
  });

  it('Enter pe un card continuă direct cu acea opțiune (46a)', async () => {
    const onContinue = vi.fn();
    render(<StartSourceScreen onContinue={onContinue} />);
    screen.getByRole('radio', { name: /De la zero/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onContinue).toHaveBeenCalledWith('scratch');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<StartSourceScreen onContinue={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
