export const $ = id => document.getElementById(id);

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
export const time = v => (v ? new Date(v).toLocaleString('ro-RO') : 'niciodată');
