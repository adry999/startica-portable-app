import { describe, expect, it } from 'vitest';
import { deriveSaveStatus, type SessionStateForSaveStatus } from './save-status';

function state(overrides: Partial<SessionStateForSaveStatus> = {}): SessionStateForSaveStatus {
  return {
    ready: true,
    loading: false,
    pending: null,
    busy: false,
    saveError: '',
    connectionError: '',
    lastSavedAt: '2026-09-23T12:06:00Z',
    health: {},
    ...overrides,
  };
}

describe('deriveSaveStatus', () => {
  it('saved: arată ora ultimei salvări', () => {
    expect(deriveSaveStatus(state()).status).toBe('saved');
    expect(deriveSaveStatus(state()).label).toMatch(/^Salvat · /);
  });

  it('unsaved: date neîncărcate încă', () => {
    expect(deriveSaveStatus(state({ ready: false })).status).toBe('unsaved');
  });

  it('unsaved: mutație în așteptare, dar nu activă (cădere de rețea)', () => {
    expect(deriveSaveStatus(state({ pending: { path: '/x', body: {} } })).status).toBe('unsaved');
  });

  it('saving: mutație activă acoperă pending', () => {
    const result = deriveSaveStatus(state({ pending: { path: '/x', body: {} }, busy: true }));
    expect(result.status).toBe('saving');
  });

  it('error: saveError acoperă saving/pending', () => {
    const result = deriveSaveStatus(state({ busy: true, saveError: 'Revizie schimbată' }));
    expect(result.status).toBe('error');
    expect(result.detail).toBe('Revizie schimbată');
  });

  it('error: connectionError are prioritatea cea mai mare', () => {
    const result = deriveSaveStatus(state({ saveError: 'x', connectionError: 'Conexiune întreruptă.' }));
    expect(result.status).toBe('error');
    expect(result.detail).toBe('Conexiune întreruptă.');
  });

  it('error: problemă de backup, chiar fără saveError', () => {
    const result = deriveSaveStatus(state({ health: { externalError: 'Folderul extern nu există' } }));
    expect(result.status).toBe('error');
    expect(result.detail).toBe('Folderul extern nu există');
  });
});
