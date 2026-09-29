import type { DragEvent } from 'react';

/** Tipul de date folosit la reordonarea grupelor (drag&drop nativ) — distinct de `'text/plain'`,
 * folosit pentru id-urile de copii, ca cele două tipuri de tragere să nu se încurce. */
export const GROUP_DRAG_TYPE = 'application/x-group-id';

/**
 * Imaginea de tragere = o copie rotită −2° a cardului sursă, cu border portocaliu și umbră
 * (A8, 4a/4b — „ca la copii”). `setDragImage` lipsește din DataTransfer-ul simulat în teste
 * (jsdom/testing-library), de-aia verificăm întâi că există.
 */
export function attachRotatedDragImage(event: DragEvent, sourceElement: HTMLElement) {
  if (typeof event.dataTransfer.setDragImage !== 'function') return;
  const rect = sourceElement.getBoundingClientRect();
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.width = `${rect.width}px`;
  clone.style.transform = 'rotate(-2deg)';
  clone.style.border = '2px solid var(--orange)';
  clone.style.boxShadow = '0 18px 36px rgba(58,71,80,.22)';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
  setTimeout(() => clone.remove(), 0);
}
