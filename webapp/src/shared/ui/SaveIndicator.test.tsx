import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveIndicator } from './SaveIndicator';

describe('SaveIndicator', () => {
  it('nu randează nimic când nu s-a salvat niciodată și nu e nici eroare, nici salvare', () => {
    const { container } = render(
      <SaveIndicator saving={false} saveError="" savedAt="" unsavedCount={0} onRetry={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('afișează „Se salvează…" cât timp saving e true', () => {
    render(<SaveIndicator saving savedAt="" saveError="" unsavedCount={0} onRetry={() => {}} />);
    expect(screen.getByText('Se salvează…')).toBeInTheDocument();
  });

  it('afișează ora ultimei salvări', () => {
    render(
      <SaveIndicator saving={false} saveError="" savedAt="2026-09-30T08:12:00Z" unsavedCount={0} onRetry={() => {}} />,
    );
    expect(screen.getByText(/Salvat ·/)).toBeInTheDocument();
  });

  it('afișează numărul de modificări nesalvate și cheamă onRetry la „Încearcă din nou"', () => {
    const onRetry = vi.fn();
    render(<SaveIndicator saving={false} saveError="rețea" savedAt="" unsavedCount={3} onRetry={onRetry} />);
    expect(screen.getByText(/Nesalvat · 3 modificări/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Încearcă din nou'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
