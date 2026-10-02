import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { RestoreRejected } from './RestoreRejected';

describe('RestoreRejected', () => {
  it('nu randează nimic fără niciun element', () => {
    const { container } = render(<RestoreRejected items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('arată cardul roz pentru versiune mai nouă (blocat)', () => {
    render(
      <RestoreRejected
        items={[
          {
            tone: 'blocked',
            title: 'Versiune mai nouă',
            message: 'Backup-ul e făcut cu Startica 2.4.0. Aici rulează 2.2.0.',
          },
        ]}
      />,
    );
    expect(screen.getByText('Versiune mai nouă')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('arată cardul galben pentru backup vechi .db (avertisment, se poate continua)', () => {
    render(
      <RestoreRejected
        items={[
          {
            tone: 'warning',
            title: 'Backup vechi (.db) · avertisment, se poate continua',
            message: 'Conține o singură filială; Comun și celelalte filiale nu se schimbă.',
          },
        ]}
      />,
    );
    expect(screen.getByText(/Backup vechi \(\.db\)/)).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <RestoreRejected
        items={[
          { tone: 'blocked', title: 'Numărătoarea nu corespunde', message: 'Nimic nu s-a scris pe disc.' },
          { tone: 'warning', title: 'Backup vechi', message: 'Avertisment.' },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
