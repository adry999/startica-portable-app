import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EditableList } from './EditableList';

interface Item {
  id: string;
  name: string;
  usedBy: number;
}

function Harness({
  initialItems,
  initialMode = 'view',
  onSave,
}: {
  initialItems: Item[];
  initialMode?: 'view' | 'edit';
  onSave?: (items: Item[]) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [saved, setSaved] = useState(initialItems);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);

  return (
    <EditableList<Item>
      title="Planuri"
      items={items}
      getId={item => item.id}
      mode={mode}
      renderView={item => <span>{item.name}</span>}
      renderEdit={item => (
        <input
          aria-label={`Nume ${item.id}`}
          value={item.name}
          onChange={event =>
            setItems(current => current.map(i => (i.id === item.id ? { ...i, name: event.target.value } : i)))
          }
        />
      )}
      deleteHint={item => (item.usedBy > 0 ? `Folosit de ${item.usedBy}` : undefined)}
      onDelete={id => setItems(current => current.filter(i => i.id !== id))}
      onAdd={() => {
        setItems(current => [...current, { id: `new-${current.length}`, name: '', usedBy: 0 }]);
        setMode('edit');
      }}
      addLabel="+ Adaugă plan"
      editLabel="Editează planuri"
      onEnterEdit={() => setMode('edit')}
      dirty={JSON.stringify(items) !== JSON.stringify(saved)}
      onSave={() => {
        setSaved(items);
        setMode('view');
        onSave?.(items);
      }}
      onCancel={() => {
        setItems(saved);
        setMode('view');
      }}
      emptyState={<p>Niciun plan adăugat</p>}
    />
  );
}

describe('EditableList', () => {
  it('modul view: arată itemii doar la citire, fără butoane de ștergere', () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} />);
    expect(screen.getByText('Program scurt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /șterge/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editează planuri' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Adaugă plan' })).toBeInTheDocument();
  });

  it('„Editează" trece în modul edit, cu câmpurile vizibile', async () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editează planuri' }));
    expect(screen.getByLabelText('Nume 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anulează' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument();
  });

  it('„+ Adaugă" din view trece direct în edit, cu un rând nou gol', async () => {
    render(<Harness initialItems={[]} />);
    expect(screen.getByText('Niciun plan adăugat')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă plan' }));
    expect(screen.getByLabelText('Nume new-0')).toBeInTheDocument();
  });

  it('un item folosit nu se poate șterge — butonul e dezactivat, cu tooltip', async () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 3 }]} initialMode="edit" />);
    expect(screen.getByRole('button', { name: /șterge/i })).toBeDisabled();
  });

  it('un item nefolosit se poate șterge', async () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} initialMode="edit" />);
    await userEvent.click(screen.getByRole('button', { name: /șterge/i }));
    expect(screen.queryByLabelText('Nume 1')).not.toBeInTheDocument();
  });

  it('„Salvează" e dezactivat până la prima modificare', async () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} initialMode="edit" />);
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nume 1'), '!');
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled();
  });

  it('„Anulează" revine la view, cu lista nesalvată', async () => {
    render(<Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} initialMode="edit" />);
    await userEvent.type(screen.getByLabelText('Nume 1'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(screen.getByText('Program scurt')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nume 1')).not.toBeInTheDocument();
  });

  it('„Salvează" apelează onSave și revine la view', async () => {
    const onSave = vi.fn();
    render(
      <Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 0 }]} initialMode="edit" onSave={onSave} />,
    );
    await userEvent.type(screen.getByLabelText('Nume 1'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave).toHaveBeenCalledWith([{ id: '1', name: 'Program scurt!', usedBy: 0 }]);
    expect(screen.queryByLabelText('Nume 1')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Harness initialItems={[{ id: '1', name: 'Program scurt', usedBy: 2 }]} initialMode="edit" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
