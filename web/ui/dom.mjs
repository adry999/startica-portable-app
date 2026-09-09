export const $ = id => document.getElementById(id);

// Contorul unui buton din nav („De rezolvat”): la 0, butonul se estompează
// (rămâne clicabil) — coada e goală, nu dezactivată.
export const setNavCount = (id, count) => {
  const badge = $(id);
  badge.textContent = count;
  badge.closest('.nav')?.classList.toggle('is-empty', count === 0);
};

// Tot HTML-ul din interfață este construit prin concatenare, deci orice valoare
// care vine din date trebuie să treacă pe aici înainte de a ajunge în innerHTML.
export const esc = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );

// null = sumă necunoscută, diferit de zero. Vezi obligation() din domain.mjs.
export const money = v =>
  v === null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) +
      ' lei';

// Ora fixă evită schimbarea zilei la conversia de fus orar.
export const date = v => (v ? new Date(v + 'T12:00:00').toLocaleDateString('ro-RO') : '—');

const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
// Lună tip „2026-09” devine „2026 Sep”, mai lizibil în listele de repartizare.
export const monthLabel = v => {
  if (!v) return '—';
  const [year, month] = v.split('-');
  return `${year} ${MONTHS_RO[Number(month) - 1] || month}`;
};
export const time = v => (v ? new Date(v).toLocaleString('ro-RO') : 'niciodată');

export const fileSize = bytes => (bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.round(bytes / 1e3) + ' KB');

// Sub 2 ani se arată în luni, ca diferența dintre copiii mici să rămână vizibilă.
export const age = v => {
  if (!v) return 'necunoscută';
  const birth = new Date(v + 'T12:00:00'),
    now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) return 'necunoscută';
  const years = Math.floor(months / 12),
    rest = months % 12;
  if (years === 0) return `${months} luni`;
  const yearsLabel = `${years} ${years === 1 ? 'an' : 'ani'}`;
  return rest === 0 ? yearsLabel : `${yearsLabel} ${rest} luni`;
};
