import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nu arată nimic sub pragul de 300 ms', () => {
    render(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('arată bara și scheletul după 300 ms', () => {
    render(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
  });
});
