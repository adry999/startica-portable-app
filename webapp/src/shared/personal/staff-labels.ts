import { worksAtAllBranches } from './timesheet-rules';
import type { Staff } from './personal.types';

// m16: dedup — implementarea unică trăiește în @shared/format/initials; reexportată aici ca să nu
// rupă consumatorii existenți (StaffProfilePage, TeamView) care o importă din staff-labels.
export { initials } from '@shared/format/initials';

/** „ambele filiale” — doar când angajatul lucrează la toate filialele existente (registrul complet). */
export function bothBranchesLabel(staff: Pick<Staff, 'branchIds'>, branchIds: string[]): string | null {
  return worksAtAllBranches(staff, branchIds) ? 'ambele filiale' : null;
}

/** Ziua de naștere ca „DD.MM” pentru tag-ul din Echipa (23a) — fără an. */
export function birthdayTag(birth: string | undefined): string | null {
  if (!birth) return null;
  const [, month, day] = birth.split('-');
  if (!month || !day) return null;
  return `${day}.${month}`;
}
