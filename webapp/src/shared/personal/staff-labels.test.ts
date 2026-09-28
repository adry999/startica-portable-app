import { describe, expect, it } from 'vitest';
import { bothBranchesLabel, birthdayTag } from './staff-labels';

describe('bothBranchesLabel', () => {
  it('arată eticheta doar când angajatul lucrează la toate filialele', () => {
    expect(bothBranchesLabel({ branchIds: ['bu', 'bo'] }, ['bu', 'bo'])).toBe('ambele filiale');
    expect(bothBranchesLabel({ branchIds: ['bu'] }, ['bu', 'bo'])).toBeNull();
  });
});

describe('birthdayTag', () => {
  it('formatează data nașterii ca DD.MM, fără an', () => {
    expect(birthdayTag('1990-03-07')).toBe('07.03');
    expect(birthdayTag(undefined)).toBeNull();
  });
});
