import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollArea } from './ScrollArea';

/** jsdom nu calculează layout real — scrollHeight/clientHeight rămân 0 implicit, deci
 * simulăm conținut care depășește viewport-ul direct pe elementele randate. */
function mockOverflow(
  viewport: HTMLElement,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(viewport, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: clientHeight, configurable: true });
}

describe('ScrollArea', () => {
  it('randează copiii', () => {
    const { getByText } = render(
      <ScrollArea>
        <p>Conținut</p>
      </ScrollArea>,
    );
    expect(getByText('Conținut')).toBeInTheDocument();
  });

  it('fără overflow (conținutul încape), nu randează bara de scroll', () => {
    const { container, getByText } = render(
      <ScrollArea>
        <p>Scurt</p>
      </ScrollArea>,
    );
    const viewport = getByText('Scurt').parentElement!;
    mockOverflow(viewport, { scrollHeight: 100, clientHeight: 100 });
    fireEvent.scroll(viewport);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('cu overflow, randează bara de scroll la scroll', async () => {
    const { container, getByText } = render(
      <ScrollArea>
        <p>Lung</p>
      </ScrollArea>,
    );
    const viewport = getByText('Lung').parentElement!;
    mockOverflow(viewport, { scrollHeight: 500, clientHeight: 100 });
    fireEvent.scroll(viewport);
    await waitFor(() => expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument());
  });

  it('o tragere pe thumb actualizează scrollTop-ul viewport-ului', async () => {
    const { container, getByText } = render(
      <ScrollArea>
        <p>Lung</p>
      </ScrollArea>,
    );
    const viewport = getByText('Lung').parentElement! as HTMLDivElement;
    mockOverflow(viewport, { scrollHeight: 500, clientHeight: 100 });
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);

    const bar = await waitFor(() => {
      const el = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    bar.getBoundingClientRect = () => ({ height: 100 }) as DOMRect;
    const thumb = bar.querySelector('div') as HTMLElement;
    thumb.setPointerCapture = () => {};
    thumb.releasePointerCapture = () => {};

    fireEvent.pointerDown(thumb, { clientY: 0 });
    fireEvent.pointerMove(thumb, { clientY: 50 });
    expect(viewport.scrollTop).toBeGreaterThan(0);
    fireEvent.pointerUp(thumb);
  });
});
