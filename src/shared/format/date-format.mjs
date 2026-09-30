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
// Lună tip „2026-09” devine „septembrie”, fără an — pentru antete de coloană (ex. „Plată septembrie”).
export const formatMonthOnly = v =>
  v ? new Date(v + '-01T12:00:00').toLocaleDateString('ro-RO', { month: 'long' }) : '—';
export const formatDateTime = v => (v ? new Date(v).toLocaleString('ro-RO') : 'niciodată');

// „24 septembrie 2026” — fără ziua săptămânii, pentru antetul confirmării de plată (16b).
export const formatDateLong = v =>
  v ? new Date(v + 'T12:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

// Titlul rezumatului zilnic Telegram, cu ziua săptămânii scrisă complet.
export const formatLongDate = v =>
  new Date(v + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// Eticheta DayStepper-ului din Prezența (18a): „Joi, 24 septembrie”, fără an.
export const formatDayLabel = v => {
  const label = new Date(v + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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

/** Vârsta în ani întregi (rotunjită în jos) — pentru filtrare/sugestii pe interval, nu afișare. */
export const ageInYears = v => {
  if (!v) return null;
  const birth = new Date(v + 'T12:00:00'),
    now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years--;
  return years < 0 ? null : years;
};
