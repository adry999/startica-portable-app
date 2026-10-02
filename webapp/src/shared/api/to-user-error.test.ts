import { describe, expect, it } from 'vitest';
import { ApiError } from '@core/web/api-error.mjs';
import { toUserError } from './to-user-error';

describe('toUserError', () => {
  it('un conflict de revizie (409) întoarce mereu același text, indiferent ce a trimis serverul', () => {
    const err = new ApiError('Revizie învechită.', { kind: 'rejected', status: 409 });
    expect(toUserError(err)).toBe('Altcineva a modificat între timp. Reîncarcă și încearcă din nou.');
  });

  it('un 409 venit de pe o altă rută (alt mesaj de server) tot primește textul fix', () => {
    const err = new ApiError('Achitarea X nu mai există. Reîncarcă datele.', { kind: 'rejected', status: 409 });
    expect(toUserError(err)).toBe('Altcineva a modificat între timp. Reîncarcă și încearcă din nou.');
  });

  it('o eroare de domeniu (400, text uman din fail()) trece neschimbată', () => {
    const err = new ApiError('PIN-ul trebuie să aibă 4–6 cifre.', { kind: 'rejected', status: 400 });
    expect(toUserError(err)).toBe('PIN-ul trebuie să aibă 4–6 cifre.');
  });

  it('o eroare de domeniu 403 (gardă) trece neschimbată', () => {
    const err = new ApiError('Filiala s-a schimbat. Reîncarcă aplicația.', { kind: 'rejected', status: 403 });
    expect(toUserError(err)).toBe('Filiala s-a schimbat. Reîncarcă aplicația.');
  });

  it('o cădere de rețea (ApiError kind network) întoarce mesajul ei, fără cod HTTP', () => {
    const err = new ApiError('Conexiune întreruptă. Apasă „Reîncarcă” pentru a verifica ultima operațiune.', {
      kind: 'network',
    });
    const message = toUserError(err);
    expect(message).toContain('Conexiune întreruptă');
    expect(message).not.toMatch(/\d{3}/);
  });

  it('un TypeError brut de fetch ("Failed to fetch") devine un mesaj de lipsă conexiune', () => {
    expect(toUserError(new TypeError('Failed to fetch'))).toBe(
      'Conexiune întreruptă. Verifică rețeaua și încearcă din nou.',
    );
  });

  it('un TypeError brut de rețea Firefox ("NetworkError when attempting to fetch resource") e recunoscut', () => {
    expect(toUserError(new TypeError('NetworkError when attempting to fetch resource'))).toBe(
      'Conexiune întreruptă. Verifică rețeaua și încearcă din nou.',
    );
  });

  it('un răspuns neașteptat (body nu-i JSON) nu arată codul HTTP din mesajul original', () => {
    const err = new ApiError('Serverul a răspuns neașteptat (cod 502). Apasă „Reîncarcă” și verifică jurnalele.', {
      kind: 'unexpected-response',
      status: 502,
    });
    const message = toUserError(err);
    expect(message).not.toContain('502');
    expect(message).not.toContain('cod');
  });

  it('o eroare de programare (TypeError) nu-și arată mesajul tehnic', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'id')");
    expect(toUserError(err)).toBe('A apărut o eroare neașteptată. Încearcă din nou.');
  });

  it('un RangeError/ReferenceError/SyntaxError primesc tot mesajul generic', () => {
    expect(toUserError(new RangeError('depășire'))).toBe('A apărut o eroare neașteptată. Încearcă din nou.');
    expect(toUserError(new ReferenceError('x is not defined'))).toBe(
      'A apărut o eroare neașteptată. Încearcă din nou.',
    );
    expect(toUserError(new SyntaxError('corp invalid'))).toBe('A apărut o eroare neașteptată. Încearcă din nou.');
  });

  it('un Error simplu, aruncat deliberat cu mesaj uman (cum simulează mock-urile de teste un eșec de server), trece neschimbat', () => {
    const err = new Error('Conflictul nu mai există — a fost rezolvat deja.');
    expect(toUserError(err)).toBe('Conflictul nu mai există — a fost rezolvat deja.');
  });

  it('o valoare aruncată care nu e Error (string, undefined) primește tot mesajul generic', () => {
    expect(toUserError('ceva oarecare')).toBe('A apărut o eroare neașteptată. Încearcă din nou.');
    expect(toUserError(undefined)).toBe('A apărut o eroare neașteptată. Încearcă din nou.');
  });
});
