import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Popover } from './Popover';

describe('Popover', () => {
  it('randează conținutul primit', () => {
    render(
      <Popover onClose={() => {}} ariaLabel="Exemplu">
        <p>Conținut</p>
      </Popover>,
    );
    expect(screen.getByText('Conținut')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Exemplu' })).toBeInTheDocument();
  });

  it('cheamă onClose la clic în afara panoului', () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button">În afară</button>
        <Popover onClose={onClose}>
          <p>Conținut</p>
        </Popover>
      </div>,
    );
    fireEvent.mouseDown(screen.getByText('În afară'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nu cheamă onClose la clic în interiorul panoului', () => {
    const onClose = vi.fn();
    render(
      <Popover onClose={onClose}>
        <p>Conținut</p>
      </Popover>,
    );
    fireEvent.mouseDown(screen.getByText('Conținut'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cheamă onClose la Escape', () => {
    const onClose = vi.fn();
    render(
      <Popover onClose={onClose}>
        <p>Conținut</p>
      </Popover>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
