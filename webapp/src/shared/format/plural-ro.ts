/** Pluralul românesc simplu (1 vs. restul) — „1 zi de naștere" / „2 zile de naștere". */
export function pluralRo(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
