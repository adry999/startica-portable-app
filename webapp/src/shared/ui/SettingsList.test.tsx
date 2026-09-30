import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsList } from './SettingsList';

interface DemoItem {
  id: string;
  name: string;
}

const ITEMS: DemoItem[] = [
  { id: 'a', name: 'Grădiniță' },
  { id: 'b', name: 'Bazin' },
];

describe('SettingsList', () => {
  it('randează numele, contorul, starea și acțiunile fiecărui rând', () => {
    render(
      <SettingsList
        items={ITEMS}
        ariaLabel="Servicii"
        renderName={item => item.name}
        renderCount={item => `${item.name.length} litere`}
        renderStatus={() => 'Activ'}
        renderActions={() => <button type="button">Editează</button>}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Bazin')).toBeInTheDocument();
    expect(screen.getAllByText('Activ')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Editează' })).toHaveLength(2);
  });

  it('nu arată mânerul de tragere fără onReorder', () => {
    const { container } = render(<SettingsList items={ITEMS} ariaLabel="Servicii" renderName={item => item.name} />);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0);
  });

  it('apelează onReorder la drop peste alt rând', () => {
    const onReorder = vi.fn();
    render(<SettingsList items={ITEMS} ariaLabel="Servicii" renderName={item => item.name} onReorder={onReorder} />);
    const rows = screen.getAllByRole('listitem');

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'a'),
      types: ['text/plain'],
      effectAllowed: '',
    };

    fireDrop(rows[1], dataTransfer);

    expect(onReorder).toHaveBeenCalledWith('a', 'b');
  });

  it('arată mesajul gol când lista e vidă', () => {
    render(
      <SettingsList<DemoItem>
        items={[]}
        ariaLabel="Servicii"
        renderName={item => item.name}
        emptyMessage="Niciun element"
      />,
    );
    expect(screen.getByText('Niciun element')).toBeInTheDocument();
  });
});

function fireDrop(element: Element, dataTransfer: unknown) {
  const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as unknown as DragEvent;
  Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
  element.dispatchEvent(dropEvent);
}
