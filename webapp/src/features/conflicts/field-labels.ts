import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Group } from '@contracts/record-types.mjs';

/** Tipurile care pot intra în conflict (18-sincronizare.md, `CONFLICT_KINDS`). */
export const KIND_LABELS: Record<string, string> = {
  children: 'Copil',
  groups: 'Grupă',
  categories: 'Categorie',
  visits: 'Vizită',
  // Personal 24 (decizia 9, 2026-09-27-personal-bazin.md): singurul kind al setului comun
  // care intră în conflict — restul lui sunt last-writer-wins.
  staff: 'Angajat',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nume',
  phone: 'Telefon părinte',
  groupId: 'Grupă',
  fee: 'Taxa',
  contractNumber: 'Contract',
  birthDate: 'Data nașterii',
  address: 'Adresă',
  notes: 'Note',
  color: 'Culoare',
  capacity: 'Capacitate',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valoarea unui câmp, gata de afișat — grupa devine numele ei, taxa e formatată, datele scurte la fel. */
export function fieldValueLabel(field: string, value: unknown, groups: Group[]): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'groupId') return groupNameOf(String(value), groups) || '—';
  if (field === 'fee') return formatMoney(Number(value));
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatDate(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
