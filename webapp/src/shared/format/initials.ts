/** Inițialele unui nume (max. 2 litere, din primele două cuvinte) — pentru avataruri. */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}
