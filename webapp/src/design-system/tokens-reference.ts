/**
 * Doar numele variabilelor din `tokens.css` — valorile se citesc din `:root` la randare,
 * ca pagina să nu dubleze culorile în cod (regula „nicio culoare hex nouă”).
 */

export interface ColorTokenGroup {
  label: string;
  tokens: string[];
}

export const COLOR_TOKEN_GROUPS: ColorTokenGroup[] = [
  {
    label: 'Bază',
    tokens: [
      '--orange',
      '--slate',
      '--muted',
      '--mint',
      '--yellow',
      '--pink',
      '--raspberry',
      '--cream',
      '--border',
      '--white',
    ],
  },
  {
    label: 'Suprafețe pastel',
    tokens: [
      '--orange-soft',
      '--mint-soft',
      '--yellow-soft',
      '--pink-soft',
      '--neutral-soft',
      '--neutral-softer',
      '--sand',
      '--sand-soft',
    ],
  },
  {
    label: 'Text pe fundal pastel (ink)',
    tokens: ['--orange-ink', '--mint-ink', '--yellow-ink', '--pink-ink'],
  },
  {
    label: 'Altele',
    tokens: ['--subtle', '--success-dot', '--row-divider', '--input-border', '--off-day'],
  },
];

export const SPACING_TOKENS = [
  '--space-4',
  '--space-6',
  '--space-8',
  '--space-10',
  '--space-12',
  '--space-14',
  '--space-16',
  '--space-18',
  '--space-20',
  '--space-24',
  '--space-28',
  '--space-40',
];

export const RADIUS_TOKENS = [
  '--radius-xs',
  '--radius-sm',
  '--radius-input',
  '--radius-md',
  '--radius-md-lg',
  '--radius-lg',
  '--radius-xl',
  '--radius-pill',
];

export const SHADOW_TOKENS = ['--shadow-card', '--shadow-button-primary', '--shadow-floating-bar', '--shadow-panel'];

/** Citește o variabilă CSS de pe `:root`; gol dacă `tokens.css` nu e încărcat (ex. în teste). */
export function readCssVariable(name: string): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
