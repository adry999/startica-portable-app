import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { BackupPreviewTable, type BackupPreviewDatabaseRow } from './BackupPreviewTable';

const databases: BackupPreviewDatabaseRow[] = [
  { id: 'common', name: 'Comun', kind: 'common', children: 0, payments: 0, expenses: 0 },
  { id: 'b1', name: 'Buiucani', kind: 'branch', children: 142, payments: 911, expenses: 264 },
  { id: 'b2', name: 'Botanica', kind: 'branch', children: 56, payments: 303, expenses: 122 },
];

describe('BackupPreviewTable', () => {
  it('arată un rând per bază și Totalul calculat doar din filiale', () => {
    render(
      <BackupPreviewTable
        fileName="startica_2026-10-01_arhiva.startica-backup"
        createdAt="2026-10-01T18:42:00.000Z"
        appVersion="2.2.0"
        databases={databases}
      />,
    );
    expect(screen.getByText('startica_2026-10-01_arhiva.startica-backup')).toBeInTheDocument();
    expect(screen.getByText('Buiucani')).toBeInTheDocument();
    expect(screen.getByText('Comun (personal, bazin, curs, planuri)')).toBeInTheDocument();
    expect(screen.getByText('198')).toBeInTheDocument();
    expect(screen.getByText('1214')).toBeInTheDocument();
    expect(screen.getByText('386')).toBeInTheDocument();
  });

  it('arată starea de încărcare', () => {
    render(<BackupPreviewTable loading fileName="" databases={[]} />);
    expect(screen.queryByText('Bază')).not.toBeInTheDocument();
  });

  it('arată starea de eroare cu buton de reîncercare', async () => {
    const onRetry = vi.fn();
    render(<BackupPreviewTable error="Backup inexistent." fileName="" databases={[]} onRetry={onRetry} />);
    expect(screen.getByText('Backup inexistent.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeInTheDocument();
  });

  it('arată un mesaj când nu există nicio bază', () => {
    render(<BackupPreviewTable fileName="gol.startica-backup" databases={[]} />);
    expect(screen.getByText('Backup fără nicio bază de date.')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <BackupPreviewTable fileName="startica_2026-10-01_arhiva.startica-backup" databases={databases} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
