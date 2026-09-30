import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UndoHistory } from './UndoHistory';

const HISTORY = [
  { id: '2', label: 'Ana: Prezent → Absent', time: '09:15' },
  { id: '1', label: 'Bogdan: Nemarcat → Prezent', time: '09:10' },
];

describe('UndoHistory', () => {
  it('dezactivează „Anulează" și „Anulează tot" când nu există istoric', () => {
    render(
      <UndoHistory history={[]} canUndo={false} onUndoLast={() => {}} onUndoUntil={() => {}} onUndoAll={() => {}} />,
    );
    expect(screen.getByText('↶ Anulează')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Istoricul zilei'));
    expect(screen.getByText('Anulează tot')).toBeDisabled();
    expect(screen.getByText('Nicio modificare încă azi.')).toBeInTheDocument();
  });

  it('apelează onUndoLast la clic pe „↶ Anulează"', () => {
    const onUndoLast = vi.fn();
    render(
      <UndoHistory history={HISTORY} canUndo onUndoLast={onUndoLast} onUndoUntil={() => {}} onUndoAll={() => {}} />,
    );
    fireEvent.click(screen.getByText('↶ Anulează'));
    expect(onUndoLast).toHaveBeenCalledTimes(1);
  });

  it('afișează intrările, cu „Anulează" doar pe cea mai recentă și „Anulează până aici" pe restul', () => {
    render(<UndoHistory history={HISTORY} canUndo onUndoLast={() => {}} onUndoUntil={() => {}} onUndoAll={() => {}} />);
    fireEvent.click(screen.getByLabelText('Istoricul zilei'));
    expect(screen.getByText('Ana: Prezent → Absent')).toBeInTheDocument();
    expect(screen.getByText('Bogdan: Nemarcat → Prezent')).toBeInTheDocument();
    const rowButtons = screen.getAllByRole('button', { name: /Anulează/ });
    expect(rowButtons.map(button => button.textContent)).toEqual([
      '↶ Anulează',
      'Anulează tot',
      'Anulează',
      'Anulează până aici',
    ]);
  });

  it('apelează onUndoUntil cu id-ul rândului ales', () => {
    const onUndoUntil = vi.fn();
    render(
      <UndoHistory history={HISTORY} canUndo onUndoLast={() => {}} onUndoUntil={onUndoUntil} onUndoAll={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('Istoricul zilei'));
    fireEvent.click(screen.getByText('Anulează până aici'));
    expect(onUndoUntil).toHaveBeenCalledWith('1');
  });

  it('apelează onUndoAll la clic pe „Anulează tot"', () => {
    const onUndoAll = vi.fn();
    render(
      <UndoHistory history={HISTORY} canUndo onUndoLast={() => {}} onUndoUntil={() => {}} onUndoAll={onUndoAll} />,
    );
    fireEvent.click(screen.getByLabelText('Istoricul zilei'));
    fireEvent.click(screen.getByText('Anulează tot'));
    expect(onUndoAll).toHaveBeenCalledTimes(1);
  });
});
