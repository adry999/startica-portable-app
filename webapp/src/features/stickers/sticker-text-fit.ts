/**
 * Regula de mărime a textului mare de pe sticker (24d) — pură, fără DOM, ca să poată fi
 * testată direct pentru criteriul „Textul nu iese din etichetă la nicio mărime".
 */
export type StickerLabelSize = '58x30' | '58x40' | '58x60';

/** Ajustarea mărimii de bază după mărimea etichetei — etichetele mici au mai puțină înălțime disponibilă. */
const SIZE_ADJUSTMENT_PX: Record<StickerLabelSize, number> = {
  '58x30': -4,
  '58x40': 0,
  '58x60': 6,
};

/** Înălțimea fizică a etichetei (lățimea e mereu 58 mm — doar înălțimea variază). */
const LABEL_HEIGHT_MM: Record<StickerLabelSize, number> = {
  '58x30': 30,
  '58x40': 40,
  '58x60': 60,
};

/** 1 px CSS = 1/96 inch, indiferent de contextul de tipar (regulă fixă din specificația CSS). */
const PX_TO_MM = 25.4 / 96;

/** Lățimea de tipar a SK58 — aceeași zonă de 48 mm ca bonul, indiferent de suport (bon sau etichetă). */
const PRINTABLE_WIDTH_MM = 48;

/** Lățimea medie a unui caracter, ca fracție din mărimea fontului — estimare conservatoare pentru Baloo 2 bold. */
const CONSERVATIVE_CHAR_WIDTH_FACTOR = 0.55;

/** Înălțimea unui rând de text, ca multiplu al mărimii fontului. */
const LINE_HEIGHT_FACTOR = 1.3;

/** Înălțime rezervată din etichetă pentru padding, rândul 2/3 și decor — restul rămâne pentru textul mare. */
const RESERVED_HEIGHT_MM = 14;

/**
 * Mărimea fontului textului mare, în px: ≤12 caractere → 30 px, ≤18 → 24 px, altfel 20 px,
 * apoi ajustată după mărimea etichetei (−4 la 58×30, +6 la 58×60).
 */
export function bigTextFontSizePx(text: string, labelSize: StickerLabelSize): number {
  const length = text.length;
  const base = length <= 12 ? 30 : length <= 18 ? 24 : 20;
  return base + SIZE_ADJUSTMENT_PX[labelSize];
}

/** Câte rânduri de text mare încap pe înălțimea disponibilă a etichetei, la o mărime de font dată. */
function maxLinesFor(labelSize: StickerLabelSize, fontSizePx: number): number {
  const availableMm = LABEL_HEIGHT_MM[labelSize] - RESERVED_HEIGHT_MM;
  const lineHeightMm = fontSizePx * PX_TO_MM * LINE_HEIGHT_FACTOR;
  return Math.max(1, Math.floor(availableMm / lineHeightMm));
}

/**
 * Verifică, cu o estimare conservatoare a lățimii per caracter, că textul mare — la mărimea de
 * font calculată de `bigTextFontSizePx` — încape pe lățimea de tipar, ținând cont și de câte
 * rânduri permite înălțimea etichetei (textul se poate întrerupe pe mai multe rânduri).
 */
export function bigTextFitsLabel(text: string, labelSize: StickerLabelSize): boolean {
  const fontSizePx = bigTextFontSizePx(text, labelSize);
  const charWidthMm = fontSizePx * PX_TO_MM * CONSERVATIVE_CHAR_WIDTH_FACTOR;
  const lineWidthMm = text.length * charWidthMm;
  const maxWidthMm = PRINTABLE_WIDTH_MM * maxLinesFor(labelSize, fontSizePx);
  return lineWidthMm <= maxWidthMm;
}
