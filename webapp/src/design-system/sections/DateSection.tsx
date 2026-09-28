import { useState } from 'react';
import {
  Badge,
  Card,
  DataTable,
  ListToolbar,
  PersonCell,
  ProfileLayout,
  ProfileNotFound,
  ProfileSection,
  RowMenu,
  SelectionBar,
  StatCard,
  type DataTableColumn,
} from '@shared/ui';
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
  const [search, setSearch] = useState('');

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
        name="PersonCell"
        importLine="import { PersonCell } from '@shared/ui';"
        reference="27-componente-comune.md #1 — avatar+nume+sub unic (Copii, Personal, Candidați)"
      >
        <DemoRow label="md">
          <PersonCell name="Coceva Alisa" sub="Contract 214" tone="orange" />
        </DemoRow>
        <DemoRow label="lg (banda fișei)">
          <PersonCell size="lg" name="Coceva Alisa" sub="Contract 214" tone="orange" />
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
        <DemoRow label="groupBy (27-componente-comune.md #2 — TeamView, grupat pe departamente)">
          <DataTable
            columns={PAYMENT_COLUMNS}
            rows={DEMO_PAYMENT_ROWS}
            rowKey={row => row.id}
            groupBy={{
              key: row => row.group,
              label: key => <strong>{key}</strong>,
            }}
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
        name="ListToolbar"
        importLine="import { ListToolbar } from '@shared/ui';"
        reference="27-componente-comune.md #3 — căutare + acțiuni + contor, unic (Copii, Personal, Candidați)"
      >
        <DemoRow label="control">
          <ListToolbar
            search={{ value: search, onChange: setSearch, ariaLabel: 'Caută', placeholder: 'Caută după nume' }}
            trailing="8 persoane"
          >
            <button type="button">Funcții</button>
          </ListToolbar>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ProfileLayout"
        importLine="import { ProfileLayout } from '@shared/ui';"
        reference="27-componente-comune.md #4 — bandă + grilă stânga/dreapta (Fișa copilului, Fișa angajatului)"
      >
        <DemoRow label="control">
          <ProfileLayout
            back={{ label: 'Copii', onClick: () => {} }}
            header={{
              name: 'Coceva Alisa',
              tone: 'orange',
              meta: '5a 2l · Contract 214',
              badges: [
                { label: 'Activ', tone: 'mint' },
                { label: 'Fluturași', tone: 'orange' },
              ],
              actions: <button type="button">Editează fișa</button>,
            }}
            left={<ProfileSection title="Părinți">Ana Coceva · 069 000 000</ProfileSection>}
            stats={[<StatCard key="sold" label="Sold" value="0 lei" tone="mint" sub="La zi" />]}
            right={<ProfileSection title="Istoric plăți">Fără achitări.</ProfileSection>}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ProfileSection"
        importLine="import { ProfileSection } from '@shared/ui';"
        reference="27-componente-comune.md #4 — card cu titlu și, opțional, un link în dreapta"
      >
        <DemoRow label="cu acțiune">
          <ProfileSection title="Note" action={{ label: '+ Notă', onClick: () => {} }}>
            Nicio notă încă.
          </ProfileSection>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="StatCard"
        importLine="import { StatCard } from '@shared/ui';"
        reference="27-componente-comune.md #4 — mini-card de statistică din dreapta unei fișe"
      >
        <DemoRow label="control">
          <StatCard label="Sold" value="0 lei" tone="mint" sub="La zi" />
          <StatCard label="Salariu" value="•••••" link={{ label: 'Vezi cu PIN →', onClick: () => {} }} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ProfileNotFound"
        importLine="import { ProfileNotFound } from '@shared/ui';"
        reference="27-componente-comune.md #4 — fișa cerută nu a fost găsită"
      >
        <DemoRow label="control">
          <ProfileNotFound back={{ label: 'Copii', onClick: () => {} }} />
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
