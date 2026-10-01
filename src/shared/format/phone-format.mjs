// `+373XXXXXXXX` → „069 123 456" — decizia 02.10 (§10): baza ține E.164, ecranul arată forma
// locală. Un număr străin (alt prefix decât +373) își păstrează prefixul; fără o convenție de
// grupare per țară în design, cifrele se grupează generic din 3 în 3, doar ca să rămână lizibil.
/**
 * @param {string} e164
 */
export function formatMoldovanPhone(e164) {
  const trimmed = typeof e164 === 'string' ? e164.trim() : '';
  if (!trimmed) return '';
  const moldovan = /^\+373(\d{8})$/.exec(trimmed);
  if (moldovan) {
    const local = '0' + moldovan[1];
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return '+' + digits.replace(/(\d{3})(?=\d)/g, '$1 ');
  }
  return trimmed;
}
