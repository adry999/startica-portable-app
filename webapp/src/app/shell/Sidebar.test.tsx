import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const saveStatus = { status: 'saved' as const, label: 'Salvat · 12:06', detail: '', onRetry: () => {} };

describe('Sidebar', () => {
  it('marchează ecranul activ cu aria-current', () => {
    render(
      <Sidebar activeView="payments" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    expect(screen.getByRole('button', { name: /Achitări/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Copii' })).not.toHaveAttribute('aria-current');
  });

  it('anunță navigarea la click pe un item', async () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar activeView="dashboard" onNavigate={onNavigate} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Grupe' }));
    expect(onNavigate).toHaveBeenCalledWith('groups');
  });

  it('ascunde contorul când e 0, îl arată când e pozitiv', () => {
    render(
      <Sidebar
        activeView="dashboard"
        onNavigate={() => {}}
        counts={{ visits: 0, fees: 3 }}
        version="v1.6.3"
        saveStatus={saveStatus}
      />,
    );
    expect(within(screen.getByRole('button', { name: /Vizite/ })).queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('afișează versiunea', () => {
    render(
      <Sidebar activeView="dashboard" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    expect(screen.getByText('v1.6.3')).toBeInTheDocument();
  });
});
