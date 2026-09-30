import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('cheamă onClick la clic', async () => {
    const onClick = vi.fn();
    render(<IconButton icon="close" ariaLabel="Închide" onClick={onClick} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Închide'));

    expect(onClick).toHaveBeenCalled();
  });

  it('e accesibil prin aria-label, fără text vizibil', () => {
    render(<IconButton icon="close" ariaLabel="Închide panoul" size="lg" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Închide panoul' })).toBeInTheDocument();
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<IconButton icon="more-horizontal" ariaLabel="Mai multe acțiuni" disabled onClick={() => {}} />);
    expect(screen.getByLabelText('Mai multe acțiuni')).toBeDisabled();
  });
});
