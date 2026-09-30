import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { DocumentCard } from './DocumentCard';

describe('DocumentCard', () => {
  it('arată numele fișierului și metadatele', () => {
    render(<DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" />);
    expect(screen.getByText('Certificat_medical.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF · 240 KB')).toBeInTheDocument();
  });

  it('apelează onOpen la click pe zona fișierului', async () => {
    const onOpen = vi.fn();
    render(<DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" onOpen={onOpen} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Certificat_medical.pdf/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('nu randează butonul de eliminare fără onRemove', () => {
    render(<DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" />);
    expect(screen.queryByRole('button', { name: /Elimină/ })).not.toBeInTheDocument();
  });

  it('apelează onRemove fără să declanșeze onOpen', async () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    render(<DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" onOpen={onOpen} onRemove={onRemove} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Elimină Certificat_medical.pdf' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" onOpen={() => {}} onRemove={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
