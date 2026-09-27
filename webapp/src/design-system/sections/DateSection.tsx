import { useState } from 'react';
import { Badge, Card, DataTable, RowMenu, SelectionBar, type DataTableColumn } from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import { DEMO_PAYMENT_ROWS, type DemoPaymentRow } from '../fixtures';
import styles from './DateSection.module.css';

const STATUS_TONE: Record<DemoPaymentRow['status'], 'mint' | 'yellow' | 'pink'> = {
  achitat: 'mint',
  partial: 'yellow',
  neachitat: 'pink',
};

const PAYMENT_COLUMNS: DataTableColumn<DemoPaymentRow>[] = [
  { key: 'child', header: 'Copil', render: row => row.child, sortValue: row => row.child },
  { key: 'group', header: 'Grupă', render: row => row.group, sortValue: row => row.group },
  {
    key: 'amount',
    header: 'Sumă',
    render: row => `${row.amount} lei`,
    sortValue: row => row.amount,
    align: 'end',
  },
  {
    key: 'status',
    header: 'Statut',
    render: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

/** Componente pentru afișarea datelor: statusuri, carduri, tabel și acțiunile lui. */
export function DateSection() {
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set());

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Date</h2>

      <ComponentShowcase
        name="Badge"
        importLine="import { Badge } from '@shared/ui';"
        reference="02-copii-lista.md (Grupă/Plată) · 04-vizite.md (Statut) · vizual în Copii.dc.html#2a"
      >
        <DemoRow label="tone">
          <Badge tone="orange">Orange</Badge>
          <Badge tone="mint">Achitat</Badge>
          <Badge tone="yellow">Parțial</Badge>
          <Badge tone="pink">Neachitat</Badge>
          <Badge tone="neutral">Neutral</Badge>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Card"
        importLine="import { Card } from '@shared/ui';"
        reference="08-dashboard.md (carduri KPI) · vizual în Dashboard.dc.html#1a"
      >
        <DemoRow label="tone">
          <Card tone="white">Alb</Card>
          <Card tone="orange">Orange</Card>
          <Card tone="mint">Mint</Card>
          <Card tone="yellow">Yellow</Card>
          <Card tone="pink">Pink</Card>
          <Card tone="dashed">Punctat</Card>
        </DemoRow>
        <DemoRow label="decorative">
          <Card tone="orange" decorative>
            Cerc decorativ
          </Card>
          <Card tone="mint" decorative="lg">
            Cerc mare (Încasări)
          </Card>
        </DemoRow>
        <DemoRow label="onClick">
          <Card tone="white" onClick={() => {}}>
            Card apăsabil
          </Card>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="DataTable"
        importLine="import { DataTable } from '@shared/ui';"
        reference="05-achitari.md (tabel sortabil) · vizual în Achitari.dc.html#5a"
      >
        <DemoRow label="cu date, sortabil, selectabil">
          <DataTable
            columns={PAYMENT_COLUMNS}
            rows={DEMO_PAYMENT_ROWS}
            rowKey={row => row.id}
            selectable
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={setSelectedRowKeys}
          />
        </DemoRow>
        <DemoRow label="gol">
          <DataTable
            columns={PAYMENT_COLUMNS}
            rows={[]}
            rowKey={row => row.id}
            emptyState={<span>Niciun rezultat pentru filtrele alese.</span>}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="RowMenu"
        importLine="import { RowMenu } from '@shared/ui';"
        reference="02-copii-lista.md (meniul ⋯) · vizual în Copii.dc.html#2a"
      >
        <DemoRow label="control">
          <RowMenu
            items={[
              { label: 'Editează', onClick: () => {} },
              { label: 'Arhivează', onClick: () => {} },
              { label: 'Șterge definitiv', onClick: () => {}, danger: true },
              { label: 'Indisponibil', onClick: () => {}, disabled: true, title: 'Doar administratorul poate' },
            ]}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SelectionBar"
        importLine="import { SelectionBar } from '@shared/ui';"
        reference="02-copii-lista.md (bara „N selectați”) · vizual în Copii.dc.html#2a"
      >
        <DemoRow label="control">
          <SelectionBar label="3 selectați" onCancel={() => {}}>
            <button type="button">Mută în grupă</button>
            <button type="button">Exportă</button>
          </SelectionBar>
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
