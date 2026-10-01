import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { EditableList } from './EditableList';

interface Plan {
  id: string;
  name: string;
  priceEur: number;
  usedBy: number;
}

const INITIAL_PLANS: Plan[] = [
  { id: 'p1', name: 'Program scurt', priceEur: 250, usedBy: 14 },
  { id: 'p2', name: 'Program mediu', priceEur: 500, usedBy: 0 },
];

function PlansDemo({ mode: initialMode }: { mode: 'view' | 'edit' }) {
  const [items, setItems] = useState(INITIAL_PLANS);
  const [saved, setSaved] = useState(INITIAL_PLANS);
  const [mode, setMode] = useState(initialMode);

  return (
    <div style={{ width: 520 }}>
      <EditableList<Plan>
        title="Planuri"
        items={items}
        getId={item => item.id}
        mode={mode}
        renderView={item => (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{item.name}</b>
            <span>{item.priceEur} €</span>
          </div>
        )}
        renderEdit={item => (
          <input
            aria-label={`Nume ${item.id}`}
            value={item.name}
            onChange={event =>
              setItems(current => current.map(i => (i.id === item.id ? { ...i, name: event.target.value } : i)))
            }
          />
        )}
        deleteHint={item => (item.usedBy > 0 ? `Folosit de ${item.usedBy} copii` : undefined)}
        onDelete={id => setItems(current => current.filter(i => i.id !== id))}
        onAdd={() => {
          setItems(current => [...current, { id: `new-${current.length}`, name: '', priceEur: 0, usedBy: 0 }]);
          setMode('edit');
        }}
        addLabel="+ Adaugă plan"
        editLabel="Editează planuri"
        onEnterEdit={() => setMode('edit')}
        dirty={JSON.stringify(items) !== JSON.stringify(saved)}
        onSave={() => {
          setSaved(items);
          setMode('view');
        }}
        onCancel={() => {
          setItems(saved);
          setMode('view');
        }}
        footerNote="Planul folosit de copii nu se poate șterge."
        emptyState={<p>Niciun plan adăugat</p>}
      />
    </div>
  );
}

const meta: Meta<typeof EditableList<Plan>> = {
  title: 'Aplicație/EditableList',
  component: EditableList,
  parameters: { design: '38d/38f — Planuri și Funcții: mod view (citire) / edit (câmpuri + ștergere condiționată)' },
};
export default meta;

type Story = StoryObj<typeof EditableList<Plan>>;

export const Vizualizare: Story = { render: () => <PlansDemo mode="view" /> };

export const Editare: Story = { render: () => <PlansDemo mode="edit" /> };

export const Gol: Story = {
  args: {
    title: 'Planuri',
    items: [],
    getId: (item: Plan) => item.id,
    mode: 'view',
    renderView: () => null,
    renderEdit: () => null,
    deleteHint: () => undefined,
    onDelete: fn(),
    onAdd: fn(),
    addLabel: '+ Adaugă plan',
    editLabel: 'Editează planuri',
    onEnterEdit: fn(),
    dirty: false,
    onSave: fn(),
    onCancel: fn(),
    emptyState: <p>Niciun plan adăugat</p>,
  },
};
