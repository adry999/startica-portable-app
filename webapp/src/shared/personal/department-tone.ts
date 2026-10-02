import type { BadgeTone } from '@shared/ui';
import type { Department } from './personal.types';

// 38f: punctul colorat arată departamentul funcției (nu funcția însăși) — aceleași 8 tonuri
// ciclice ca grupele (group-tone.ts), după poziția departamentului în listă.
export const ROLE_TONES: BadgeTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

export function departmentTone(departmentId: string, departmentList: Department[]): BadgeTone {
  const sorted = departmentList.slice().sort((a, b) => a.order - b.order);
  const index = sorted.findIndex(department => department.id === departmentId);
  return ROLE_TONES[index === -1 ? 0 : index % ROLE_TONES.length];
}
