export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function monthOK(v) {
  return (
    typeof v === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(v) &&
    Number(v.slice(0, 4)) >= 1900 &&
    Number(v.slice(0, 4)) <= 2200
  );
}
export function dateOK(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !monthOK(v.slice(0, 7))) return false;
  const date = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
// Ora fixă la prânz UTC: aritmetica pe zile nu este afectată de ora de vară.
export const shiftDays = (day, delta) =>
  new Date(new Date(day + 'T12:00:00Z').getTime() + delta * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from, to) =>
  Math.round((new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime()) / 86400000);
