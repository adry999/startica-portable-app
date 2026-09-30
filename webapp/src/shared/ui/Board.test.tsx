import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Board, type BoardColumn } from './Board';

function makeColumns(): BoardColumn[] {
  return [
    { key: 'sosit', title: 'Sosit', cards: [{ key: 'c1', label: 'Ionescu Maria' }] },
    { key: 'plecat', title: 'Plecat', cards: [] },
    { key: 'plina', title: 'Grupa Mars', cards: [], disabledReason: 'Grupa e plină' },
  ];
}

describe('Board', () => {
  it('randează coloanele și cardurile lor', () => {
    render(<Board columns={makeColumns()} onMoveCard={vi.fn()} />);
    expect(screen.getByText('Sosit')).toBeInTheDocument();
    expect(screen.getByText('Ionescu Maria')).toBeInTheDocument();
  });

  it('afișează motivul unei coloane dezactivate', () => {
    render(<Board columns={makeColumns()} onMoveCard={vi.fn()} />);
    expect(screen.getByText('Grupa e plină')).toBeInTheDocument();
  });

  it('apelează onMoveCard la drop pe altă coloană', () => {
    const onMoveCard = vi.fn();
    render(<Board columns={makeColumns()} onMoveCard={onMoveCard} />);
    const card = screen.getByText('Ionescu Maria');
    const targetColumn = screen.getByText('Plecat').closest('div')!.parentElement!;

    fireEvent.dragStart(card);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect(onMoveCard).toHaveBeenCalledWith('c1', 'sosit', 'plecat');
  });

  it('nu apelează onMoveCard la drop pe o coloană dezactivată', () => {
    const onMoveCard = vi.fn();
    render(<Board columns={makeColumns()} onMoveCard={onMoveCard} />);
    const card = screen.getByText('Ionescu Maria');
    const disabledColumn = screen.getByText('Grupa Mars').closest('div')!.parentElement!;

    fireEvent.dragStart(card);
    fireEvent.dragOver(disabledColumn);
    fireEvent.drop(disabledColumn);

    expect(onMoveCard).not.toHaveBeenCalled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Board columns={makeColumns()} onMoveCard={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
