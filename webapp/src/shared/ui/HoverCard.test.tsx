import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverCard } from './HoverCard';

describe('HoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nu afișează cardul înainte de hover', () => {
    render(
      <HoverCard content="Detalii suplimentare">
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    expect(screen.queryByText('Detalii suplimentare')).not.toBeInTheDocument();
  });

  it('afișează cardul după 400ms de hover, nu mai devreme', () => {
    render(
      <HoverCard content="Detalii suplimentare">
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Declanșator' }));

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByText('Detalii suplimentare')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Detalii suplimentare')).toBeInTheDocument();
  });

  it('ascunde cardul după 200ms de la mouse-leave', () => {
    render(
      <HoverCard content="Detalii suplimentare">
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    const trigger = screen.getByRole('button', { name: 'Declanșator' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('Detalii suplimentare')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.getByText('Detalii suplimentare')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Detalii suplimentare')).not.toBeInTheDocument();
  });

  it('nu se ascunde dacă mouse-ul intră pe card înainte să expire întârzierea', () => {
    render(
      <HoverCard content="Detalii suplimentare">
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    const trigger = screen.getByRole('button', { name: 'Declanșator' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.mouseEnter(screen.getByText('Detalii suplimentare'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('Detalii suplimentare')).toBeInTheDocument();
  });

  it('arată un schelet în locul conținutului cât timp `loading` e adevărat', () => {
    render(
      <HoverCard content="Detalii suplimentare" loading>
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Declanșator' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Detalii suplimentare')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <HoverCard content="Detalii suplimentare">
        <button type="button">Declanșator</button>
      </HoverCard>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Declanșator' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
