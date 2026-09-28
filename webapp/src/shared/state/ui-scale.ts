import { useEffect, useState } from 'react';

export type UiScale = 'compact' | 'normal' | 'large';

const STORAGE_KEY = 'ui.scale';
const DEFAULT_SCALE: UiScale = 'compact';
const ZOOM_BY_SCALE: Record<UiScale, string> = {
  compact: '0.9',
  normal: '1',
  large: '1.1',
};

function isUiScale(value: string | null): value is UiScale {
  return value === 'compact' || value === 'normal' || value === 'large';
}

/** Preferință per calculator (nu per grădiniță) — de-asta trăiește în localStorage, nu în /api/kindergarten. */
export function readStoredUiScale(): UiScale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isUiScale(raw) ? raw : DEFAULT_SCALE;
  } catch {
    return DEFAULT_SCALE;
  }
}

function applyUiScale(scale: UiScale) {
  document.documentElement.style.setProperty('zoom', ZOOM_BY_SCALE[scale]);
}

/** Apelat o singură dată în main.tsx, înainte de primul render — evită un flash la 100%. */
export function initUiScale() {
  applyUiScale(readStoredUiScale());
}

export function useUiScale() {
  const [scale, setScaleState] = useState<UiScale>(() => readStoredUiScale());

  useEffect(() => {
    applyUiScale(scale);
  }, [scale]);

  function setScale(next: UiScale) {
    setScaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // preferință doar pe acest calculator; dacă localStorage e indisponibil, zoom-ul tot se aplică pentru sesiunea curentă
    }
  }

  return { scale, setScale };
}
