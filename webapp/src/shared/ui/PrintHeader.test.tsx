import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintHeader } from './PrintHeader';

describe('PrintHeader', () => {
  it('randează titlul, subtitlul și blocul din dreapta', () => {
    render(<PrintHeader title="Situația plăților" subtitle="la 2026-09-30" aside={<span>Startica</span>} />);
    expect(screen.getByText('Situația plăților')).toBeInTheDocument();
    expect(screen.getByText('la 2026-09-30')).toBeInTheDocument();
    expect(screen.getByText('Startica')).toBeInTheDocument();
  });

  it('nu randează subtitlul/aside când lipsesc', () => {
    render(<PrintHeader title="Situația plăților" />);
    expect(screen.getByText('Situația plăților')).toBeInTheDocument();
  });
});
