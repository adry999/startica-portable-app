import { useState } from 'react';
import { total } from '@domain/money.mjs';
import { Badge, Card, DataTable, Drawer, SegmentedControl, useToast, type DataTableColumn } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';

interface Child {
  id: string;
  name: string;
  status: 'Achitat' | 'Parțial' | 'Neachitat';
  fee: number;
}

const children: Child[] = [
  { id: 'c1', name: 'Andrei Popescu', status: 'Achitat', fee: 1500 },
  { id: 'c2', name: 'Maria Ionescu', status: 'Parțial', fee: 2000 },
];

const columns: DataTableColumn<Child>[] = [
  { key: 'name', header: 'Copil', render: c => c.name, sortValue: c => c.name },
  {
    key: 'status',
    header: 'Plată',
    render: c => <Badge tone={c.status === 'Achitat' ? 'mint' : 'yellow'}>{c.status}</Badge>,
  },
  { key: 'fee', header: 'Taxă', render: c => `${c.fee} lei`, sortValue: c => c.fee, align: 'end' },
];

// Scaffold placeholder: dovedește tooling-ul webapp/ (Vite, TS, @domain/@shared, design tokens,
// shared/ui) funcțional înainte de shell-ul și ecranele reale (pașii 4-5 din spec).
export function App() {
  const [view, setView] = usePersistedState<'table' | 'monthly'>('scaffold.view', 'table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toast = useToast();
  const sample = total([{ amount: 10 }, { amount: 5.5 }]);

  return (
    <main style={{ padding: 40, display: 'grid', gap: 24 }}>
      <h1>Startica — scaffold</h1>
      <p>@domain/money.mjs total([10, 5.5]) = {sample}</p>

      <Card tone="orange" decorative>
        <p>Încasări</p>
        <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 36 }}>12 450 lei</strong>
      </Card>

      <SegmentedControl
        ariaLabel="Vizualizare"
        value={view}
        onChange={setView}
        options={[
          { value: 'table', label: 'Tabel' },
          { value: 'monthly', label: 'Pe luni' },
        ]}
      />

      <DataTable columns={columns} rows={children} rowKey={c => c.id} />

      <button type="button" onClick={() => setDrawerOpen(true)}>
        + Adaugă copil
      </button>
      <Drawer open={drawerOpen} title="Copil nou" onClose={() => setDrawerOpen(false)}>
        <p>Formular (pasul 5 din plan).</p>
      </Drawer>

      <button
        type="button"
        onClick={() => toast.show({ message: '2 achitări arhivate', actionLabel: 'Anulează', onAction: () => {} })}
      >
        Arhivează selectate
      </button>
    </main>
  );
}
