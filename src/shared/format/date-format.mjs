// Ora fixă evită schimbarea zilei la conversia de fus orar.
export const formatDate = v => (v ? new Date(v + 'T12:00:00').toLocaleDateString('ro-RO') : '—');

const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
// Lună tip „2026-09” devine „2026 Sep”, mai lizibil în listele de repartizare.
export const formatMonthLabel = v => {
  if (!v) return '—';
  const [year, month] = v.split('-');
  return `${year} ${MONTHS_RO[Number(month) - 1] || month}`;
};
// Lună tip „2026-09” devine „septembrie 2026”, pentru text adresat direct părinților.
export const formatMonthName = v =>
  v ? new Date(v + '-01T12:00:00').toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }) : '—';
export const formatDateTime = v => (v ? new Date(v).toLocaleString('ro-RO') : 'niciodată');

// Sub 2 ani se arată în luni, ca diferența dintre copiii mici să rămână vizibilă.
export const formatAge = v => {
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
