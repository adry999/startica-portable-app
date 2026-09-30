import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SmsPreview } from './SmsPreview';

describe('SmsPreview', () => {
  it('arată numele expeditorului și textul mesajului', () => {
    render(<SmsPreview senderName="Gradinita Pitici" message="Buna ziua!" />);
    expect(screen.getByText('Gradinita Pitici')).toBeInTheDocument();
    expect(screen.getByText('Buna ziua!')).toBeInTheDocument();
  });

  it('include contorul de segmente pentru mesajul curent', () => {
    render(<SmsPreview senderName="Gradinita Pitici" message="Buna ziua!" />);
    expect(screen.getByText('10/160 · 1 SMS')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<SmsPreview senderName="Gradinita Pitici" message="Buna ziua!" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
