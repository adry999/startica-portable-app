import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Topbar } from './Topbar';

describe('Topbar', () => {
  it('arată eyebrow și titlul ecranului curent', () => {
    render(<Topbar view="payments" month="2026-09" onMonthChange={() => {}} />);
    expect(screen.getByText('Contabilitate')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Achitări' })).toBeInTheDocument();
  });

  it('arată căutarea globală doar pe Dashboard', () => {
    const { rerender } = render(<Topbar view="dashboard" month="2026-09" onMonthChange={() => {}} />);
    expect(screen.getByPlaceholderText('Caută copil, părinte, achitare…')).toBeInTheDocument();

    rerender(<Topbar view="payments" month="2026-09" onMonthChange={() => {}} />);
    expect(screen.queryByPlaceholderText('Caută copil, părinte, achitare…')).not.toBeInTheDocument();
  });

  it('afișează selectorul de lună pe orice ecran', () => {
    render(<Topbar view="expenses" month="2026-09" onMonthChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Septembrie 2026' })).toBeInTheDocument();
  });
});
