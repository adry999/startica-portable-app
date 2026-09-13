// Tot HTML-ul din interfață este construit prin concatenare, deci orice valoare
// care vine din date trebuie să treacă pe aici înainte de a ajunge în innerHTML.
export const escapeHtml = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
  );
