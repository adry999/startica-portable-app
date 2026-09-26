import { useEffect, useState } from 'react';
import { requestJson } from './session';

export interface PlanPreset {
  id: string;
  name: string;
  priceEur: number;
}

export interface PlanPresetsState {
  ready: boolean;
  presets: PlanPreset[];
}

/** Citire minimală, doar lista de presetări — scurtătură de sumă la copil nou/EUR. Vezi features/backup/useExchangeRates.ts pentru editarea lor din Setări. */
export function usePlanPresets(): PlanPresetsState {
  const [presets, setPresets] = useState<PlanPreset[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = (await requestJson('/api/plan-presets')) as PlanPreset[];
        setPresets(response);
      } catch {
        // Fără presetări cunoscute, formularul rămâne cu taxa liberă, editabilă manual.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return { ready, presets };
}
