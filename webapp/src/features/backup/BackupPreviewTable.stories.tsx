import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { BackupPreviewTable, type BackupPreviewDatabaseRow } from './BackupPreviewTable';

const databases: BackupPreviewDatabaseRow[] = [
  { id: 'common', name: 'Comun', kind: 'common', children: 0, payments: 0, expenses: 0 },
  { id: 'b1', name: 'Buiucani', kind: 'branch', children: 142, payments: 911, expenses: 264 },
  { id: 'b2', name: 'Botanica', kind: 'branch', children: 56, payments: 303, expenses: 122 },
];

const meta: Meta<typeof BackupPreviewTable> = {
  title: 'Backup/BackupPreviewTable',
  component: BackupPreviewTable,
  parameters: { design: 'Prima pornire.dc.html#46b — previzualizare din manifest' },
  args: {
    fileName: 'startica_2026-10-01_arhiva.startica-backup',
    createdAt: '2026-10-01T18:42:00.000Z',
    appVersion: '2.2.0',
    databases,
  },
};
export default meta;

type Story = StoryObj<typeof BackupPreviewTable>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Error: Story = {
  args: {
    error:
      'Numărătoarea bazei „Buiucani” nu corespunde manifestului arhivei — arhiva ar putea fi coruptă sau incompletă.',
    onRetry: fn(),
  },
};

export const Empty: Story = { args: { databases: [] } };
