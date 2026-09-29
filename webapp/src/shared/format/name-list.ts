/** „Ana, Ion, Maria și încă 2" — lista de nume dintr-un `ConfirmDeleteDialog` de lot (B2, 15h). */
export function formatNameList(names: string[], max = 5): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} și încă ${names.length - max}`;
}
