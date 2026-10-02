import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack';

export interface UsePanelControllerOptions {
  open: boolean;
  onClose: () => void;
  /** Întors true blochează închiderea (ex. modificări nesalvate, 40c). */
  shouldBlockClose?: () => boolean;
  /** Override explicit — dacă lipsește, panoul își numără singur câmpurile native nevalide. */
  errorCount?: number;
}

export interface PanelController {
  panelRef: RefObject<HTMLDivElement | null>;
  /** De dat ca `onClick`/Esc/clic-pe-fundal — verifică `shouldBlockClose` înainte de `onClose`. */
  requestClose: () => void;
  /** „N erori” (44d) — explicit prin `errorCount`, altfel numărat din evenimentele `invalid`. */
  effectiveErrorCount: number;
}

// `type="number"` exclus intenționat: are un algoritm de sanitizare HTML care, pe un câmp deja
// focusat, poate pierde zecimalele unei valori scrise programatic puțin mai târziu (ex. suma
// precompletată dintr-un `defaultChildId`, verificat în jsdom pe `PaymentFormDrawer`) — un câmp
// de sumă/preț e tocmai genul de câmp recalculat async la scurt timp după montare, așa că nu e
// un candidat sigur pentru focus automat oricum.
const FIELD_SELECTOR =
  'input:not([disabled]):not([type="hidden"]):not([type="number"]), select:not([disabled]), textarea:not([disabled])';
const ANY_FOCUSABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';

/** Primul câmp al formularului (nu antetul — butonul × nu trebuie să fure focus-ul, 44d). */
function focusFirstField(panel: HTMLElement) {
  const notInHeader = (el: Element) => el.closest('header') === null;
  const fields = Array.from(panel.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(notInHeader);
  if (fields[0]) {
    fields[0].focus();
    return;
  }
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(ANY_FOCUSABLE_SELECTOR)).filter(notInHeader);
  focusable[0]?.focus();
}

/**
 * Comportamentul comun `Drawer`/`Dialog` (44d, COMPONENTE.md §0b) — scris o singură dată aici,
 * nu pe fiecare formular: focus pe primul câmp la deschidere, Esc → `onClose` (prin
 * `shouldBlockClose`, ex. 40c), Ctrl+Enter = trimite `<form>`-ul din panou, „N erori” numărate
 * din evenimentele native `invalid` când apelantul nu dă `errorCount` explicit. `overlay-stack`
 * ține cont de ordinea de deschidere, ca Esc/Ctrl+Enter să ajungă doar la panoul de sus (ex.
 * `UnsavedChangesDialog` peste `Drawer`-ul care l-a deschis).
 */
export function usePanelController({
  open,
  onClose,
  shouldBlockClose,
  errorCount,
}: UsePanelControllerOptions): PanelController {
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayIdRef = useRef<symbol | null>(null);
  const [nativeErrorCount, setNativeErrorCount] = useState(0);

  // Ref, nu closure direct în effect: Esc/Ctrl+Enter trebuie să vadă mereu onClose/shouldBlockClose
  // curente, nu pe cele din randarea în care s-a deschis panoul.
  const requestCloseRef = useRef<() => void>(() => {});
  requestCloseRef.current = () => {
    if (shouldBlockClose?.()) return;
    onClose();
  };
  const requestClose = useCallback(() => requestCloseRef.current(), []);

  useEffect(() => {
    if (!open) return undefined;
    const id = pushOverlay();
    overlayIdRef.current = id;
    return () => {
      popOverlay(id);
      overlayIdRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    focusFirstField(panel);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (!isTopOverlay(overlayIdRef.current)) return;
      if (event.key === 'Escape') {
        requestCloseRef.current();
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        const form = panelRef.current?.querySelector('form');
        if (form) {
          event.preventDefault();
          form.requestSubmit();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setNativeErrorCount(0);
      return undefined;
    }
    const panel = panelRef.current;
    if (!panel) return undefined;
    let pending = 0;
    let scheduled = false;
    function flush() {
      scheduled = false;
      setNativeErrorCount(pending);
      pending = 0;
    }
    function onInvalid() {
      pending += 1;
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    }
    function onFieldChange() {
      setNativeErrorCount(0);
    }
    panel.addEventListener('invalid', onInvalid, true);
    panel.addEventListener('input', onFieldChange, true);
    panel.addEventListener('change', onFieldChange, true);
    return () => {
      panel.removeEventListener('invalid', onInvalid, true);
      panel.removeEventListener('input', onFieldChange, true);
      panel.removeEventListener('change', onFieldChange, true);
    };
  }, [open]);

  return { panelRef, requestClose, effectiveErrorCount: errorCount ?? nativeErrorCount };
}

/** Text „N erori”/„1 eroare” (44d) — plural românesc simplu, pentru subsolul fix. */
export function errorCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'eroare' : 'erori'}`;
}
