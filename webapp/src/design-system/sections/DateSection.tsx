import { useState } from 'react';
import {
  Badge,
  BarChart,
  Card,
  DataTable,
  DiffTable,
  Kpi,
  ListToolbar,
  Legend,
  PersonCell,
  ProfileLayout,
  ProfileNotFound,
  ProfileSection,
  ProgressBar,
  RowMenu,
  SelectionBar,
  ServiceBadge,
  serviceTone,
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
        name="ServiceBadge"
        importLine="import { ServiceBadge } from '@shared/ui';"
        reference="Administrare.dc.html#10d (Servicii) · Achitari.dc.html#5a — tonul vine din `service.tone`"
      >
        <DemoRow label="serviciu">
          <ServiceBadge service={{ name: 'Grădiniță', tone: 'orange' }} />
          <ServiceBadge service={{ name: 'Bazin', tone: 'blue' }} />
          <ServiceBadge service={{ name: 'Excursie', tone: 'purple' }} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="serviceTone"
        importLine="import { serviceTone } from '@shared/ui';"
        reference="Administrare.dc.html#10d — tonul unui serviciu, direct din `service.tone`"
      >
        <DemoRow label="rezultat">
          <span>{serviceTone({ name: 'Bazin', tone: 'blue' })}</span>
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
        name="Kpi"
        importLine="import { Kpi } from '@shared/ui';"
        reference="DS Componente.dc.html §28c — KPI cu tone/size/emphasis/decorative"
      >
        <DemoRow label="ready">
          <Kpi tone="orange" decorative="lg" size="lg" label="Încasări" value="45 320 lei" />
        </DemoRow>
        <DemoRow label="loading">
          <Kpi tone="mint" label="Cheltuieli" value="—" state="loading" />
        </DemoRow>
        <DemoRow label="refreshing">
          <Kpi tone="yellow" label="Diferență" value="12 100 lei" state="refreshing" />
        </DemoRow>
        <DemoRow label="error">
          <Kpi tone="dashed" label="Avansuri" value="—" state="error" onRetry={() => {}} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="DiffTable"
        importLine="import { DiffTable } from '@shared/ui';"
        reference="DS Componente 2.dc.html §34e — Conflicte, comparație locală/de la distanță"
      >
        <DemoRow label="control">
          <DiffTable
            columns={[
              { key: 'local', label: 'Pe acest calculator' },
              { key: 'remote', label: 'Pe LAPTOP-ANA' },
            ]}
            rows={[
              { key: 'name', label: 'Nume', local: 'Ionescu Maria', remote: 'Ionescu Maria', differs: false },
              { key: 'phone', label: 'Telefon', local: '069123456', remote: '069999999', differs: true },
            ]}
            note="Rândurile galbene diferă. Celelalte câmpuri sunt identice."
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ProgressBar"
        importLine="import { ProgressBar } from '@shared/ui';"
        reference="DS Date si grafice.dc.html §28e — simplu/segmentat/capacitate"
      >
        <DemoRow label="simple">
          <ProgressBar value={62} tone="orange" label="Completare taxe" />
        </DemoRow>
        <DemoRow label="segmented">
          <ProgressBar
            variant="segmented"
            segments={[
              { value: 45, tone: 'mint' },
              { value: 30, tone: 'orange' },
              { value: 15, tone: 'yellow' },
            ]}
          />
        </DemoRow>
        <DemoRow label="capacity">
          <ProgressBar variant="capacity" filled={8} total={10} label="Locuri ocupate" />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="BarChart"
        importLine="import { BarChart } from '@shared/ui';"
        reference="DS Date si grafice.dc.html §30d — 2 serii, luna curentă intensă"
      >
        <DemoRow label="ready">
          <BarChart
            ariaLabel="Încasări și cheltuieli pe ultimele 6 luni"
            series={[
              { label: 'Apr', value: 32000 },
              { label: 'Mai', value: 38000 },
              { label: 'Iun', value: 29000 },
              { label: 'Iul', value: 41000 },
              { label: 'Aug', value: 35000 },
              { label: 'Sep', value: 45000, current: true },
            ]}
            secondarySeries={[
              { label: 'Apr', value: 21000 },
              { label: 'Mai', value: 24000 },
              { label: 'Iun', value: 19000 },
              { label: 'Iul', value: 27000 },
              { label: 'Aug', value: 23000 },
              { label: 'Sep', value: 29000, current: true },
            ]}
          />
        </DemoRow>
        <DemoRow label="loading">
          <BarChart ariaLabel="Se încarcă" series={[]} state="loading" />
        </DemoRow>
        <DemoRow label="empty">
          <BarChart ariaLabel="Fără date" series={[]} state="empty" />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Legend"
        importLine="import { Legend } from '@shared/ui';"
        reference="DS Date si grafice.dc.html §28e — explicația culorilor unui grafic"
      >
        <DemoRow label="control">
          <Legend
            items={[
              { tone: 'mint', label: 'Cash 12 450 lei' },
              { tone: 'orange', label: 'Card 8 200 lei' },
              { tone: 'yellow', label: 'Transfer 3 100 lei' },
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
