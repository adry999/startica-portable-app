import { describe, expect, it } from 'vitest';
import { groupTone } from './group-tone';

describe('groupTone', () => {
  const groups = [
    { id: 'g1', name: 'Alfa' },
    { id: 'g2', name: 'Beta' },
    { id: 'g3', name: 'Gama' },
  ];

  it('fără grupă → neutru', () => {
    expect(groupTone(null, groups)).toBe('neutral');
  });

  it('grupă necunoscută → neutru', () => {
    expect(groupTone('lipsă', groups)).toBe('neutral');
  });

  it('fără tone salvat, culoarea vine din poziția alfabetică', () => {
    expect(groupTone('g1', groups)).toBe('yellow');
    expect(groupTone('g2', groups)).toBe('pink');
    expect(groupTone('g3', groups)).toBe('teal');
  });

  it('group.tone ales manual în Drawer are prioritate față de poziție', () => {
    const withManualTone = [{ id: 'g1', name: 'Alfa', tone: 'coral' }, ...groups.slice(1)];
    expect(groupTone('g1', withManualTone)).toBe('coral');
    // celelalte grupe rămân poziționale, neafectate de tone-ul manual al lui g1
    expect(groupTone('g2', withManualTone)).toBe('pink');
  });

  it('o valoare tone necunoscută (coruptă) cade pe calculul pozițional', () => {
    const withInvalidTone = [{ id: 'g1', name: 'Alfa', tone: 'nu-exista' }, ...groups.slice(1)];
    expect(groupTone('g1', withInvalidTone)).toBe('yellow');
  });
});
