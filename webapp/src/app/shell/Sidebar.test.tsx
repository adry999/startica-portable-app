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

  it('versiunea stă în dreapta rândului Backup și setări, nu lângă logo', () => {
    render(
      <Sidebar activeView="dashboard" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    const settingsRow = screen.getByRole('button', { name: /Backup și setări/ });
    expect(within(settingsRow).getByText('v1.6.3')).toBeInTheDocument();
    const logo = screen.getByRole('img', { name: 'Startica' });
    expect(within(logo.parentElement as HTMLElement).queryByText('v1.6.3')).not.toBeInTheDocument();
  });

  it('randează selectorul de filială sub logo doar când filiala e cunoscută', () => {
    const branch = { id: 'b1', name: 'Buiucani', color: 'orange', address: '' };
    const { rerender } = render(
      <Sidebar activeView="dashboard" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    expect(screen.queryByText('Filiala')).not.toBeInTheDocument();

    rerender(
      <Sidebar
        activeView="dashboard"
        onNavigate={() => {}}
        counts={{}}
        version="v1.6.3"
        saveStatus={saveStatus}
        branch={branch}
        branches={[branch]}
      />,
    );
    expect(screen.getByText('Filiala')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buiucani/ })).toBeInTheDocument();
  });

  it('cu sincronizarea configurată cardul de sincronizare înlocuiește „Salvat · ora”', () => {
    render(
      <Sidebar
        activeView="dashboard"
        onNavigate={() => {}}
        counts={{}}
        version="v1.6.3"
        saveStatus={saveStatus}
        syncStatus={{ mode: 'synced', label: 'Sincronizat · 12:06', detail: 'Toate calculatoarele au aceleași date' }}
      />,
    );
    expect(screen.getByText('Sincronizat · 12:06')).toBeInTheDocument();
    expect(screen.queryByText('Salvat · 12:06')).not.toBeInTheDocument();
  });

  it('fără syncStatus rămâne cardul „Salvat · ora” de astăzi', () => {
    render(
      <Sidebar activeView="dashboard" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    expect(screen.getByText('Salvat · 12:06')).toBeInTheDocument();
  });

  it('Prezența stă imediat după Grupe', () => {
    render(
      <Sidebar activeView="dashboard" onNavigate={() => {}} counts={{}} version="v1.6.3" saveStatus={saveStatus} />,
    );
    const labels = screen.getAllByRole('button').map(button => button.textContent);
    const groupsIndex = labels.findIndex(label => label?.includes('Grupe'));
    const attendanceIndex = labels.findIndex(label => label?.includes('Prezența'));
    expect(attendanceIndex).toBe(groupsIndex + 1);
  });
});
