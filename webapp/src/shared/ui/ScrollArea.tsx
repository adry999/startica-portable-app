import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ScrollArea.module.css';

export interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scroll subțire (13-formulare.md 15g, FEEDBACK.md 28.09 §2b): bară de 3px (5px la hover/tragere),
 * pistă invizibilă care nu ocupă loc — nu bara nativă (min. ~6px în Chrome, ~8px în Firefox).
 * Fără overflow real, bara nu se randează.
 */
export function ScrollArea({ children, className }: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [atEnd, setAtEnd] = useState(true);
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame = 0;
    function measure() {
      const el = viewport;
      if (!el) return;
      const { scrollHeight, clientHeight, scrollTop } = el;
      if (scrollHeight <= clientHeight) {
        setThumb(null);
        setAtEnd(true);
        return;
      }
      const barHeight = el.getBoundingClientRect().height - 12; // top:6 + bottom:6 din CSS
      const height = Math.max(32, (clientHeight * clientHeight) / scrollHeight);
      const maxTop = barHeight - height;
      const top = maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
      setThumb({ height, top });
      setAtEnd(scrollTop + clientHeight >= scrollHeight - 1);
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    measure();
    viewport.addEventListener('scroll', onScroll);
    // jsdom (teste) nu are ResizeObserver — randarea rămâne corectă, doar fără recalcul la resize.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(viewport);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [children]);

  function onThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    dragState.current = { startY: event.clientY, startScrollTop: viewport.scrollTop };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onThumbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const bar = barRef.current;
    const drag = dragState.current;
    if (!viewport || !bar || !drag) return;
    const { scrollHeight, clientHeight } = viewport;
    const barHeight = bar.getBoundingClientRect().height;
    const deltaY = event.clientY - drag.startY;
    const scrollable = scrollHeight - clientHeight;
    const ratio = barHeight > 0 ? scrollable / barHeight : 0;
    viewport.scrollTop = drag.startScrollTop + deltaY * ratio;
  }

  function onThumbPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return; // click pe thumb, nu pe pistă
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const direction = event.clientY < rect.top + (thumb?.top ?? 0) ? -1 : 1;
    viewport.scrollTop += direction * viewport.clientHeight * 0.9;
  }

  return (
    <div className={`${styles.root} ${className ?? ''} ${atEnd ? styles.atEnd : ''}`}>
      <div className={styles.viewport} ref={viewportRef}>
        {children}
      </div>
      {thumb && (
        <div ref={barRef} className={`${styles.bar} ${dragging ? styles.dragging : ''}`} aria-hidden="true" onPointerDown={onTrackPointerDown}>
          <div
            className={styles.thumb}
            style={{ height: thumb.height, top: thumb.top }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
          />
        </div>
      )}
    </div>
  );
}
